import type { GatewayProfile, KeyItem, PoolConfig } from './types.js'

export const DEFAULT_GATEWAYS: GatewayProfile[] = [
  {
    id: 'intern',
    name: '🌟 书生·砚 (PJLab)',
    targetBase: 'https://discovery-api.intern-ai.org.cn/v1',
    defaultModel: 'deepseek-v4-flash-0731',
    customModels: 'deepseek-v4-flash-0731,Agents-A1,Atria-Dawn-Preview',
    fetchedModels: ['deepseek-v4-flash-0731', 'Agents-A1', 'Atria-Dawn-Preview'],
  },
  {
    id: 'deepseek',
    name: '🐳 DeepSeek 官方',
    targetBase: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    customModels: 'deepseek-chat,deepseek-reasoner',
    fetchedModels: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'silicon',
    name: '⚡ 硅基流动 SiliconFlow',
    targetBase: 'https://api.siliconflow.cn/v1',
    defaultModel: 'deepseek-ai/DeepSeek-V3',
    customModels: 'deepseek-ai/DeepSeek-V3,deepseek-ai/DeepSeek-R1',
    fetchedModels: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1'],
  },
  {
    id: 'openrouter',
    name: '🌐 OpenRouter',
    targetBase: 'https://openrouter.ai/api/v1',
    defaultModel: 'deepseek/deepseek-r1',
    customModels: 'deepseek/deepseek-r1,anthropic/claude-3.5-sonnet',
    fetchedModels: ['deepseek/deepseek-r1'],
  },
]

export const DEFAULT_CONFIG: PoolConfig = {
  activeGatewayId: 'intern',
  gateways: DEFAULT_GATEWAYS,
  adminPassword: '',
  clientApiKey: '',
  autoResetDays: 7,
  maxRetries: 5,
}

const KV_KEYS = 'key_pool_items'
const KV_CONFIG = 'key_pool_config'

let memoryKeysCache: { items: KeyItem[]; expiresAt: number } | null = null
let memoryConfigCache: { config: PoolConfig; expiresAt: number } | null = null

export async function loadConfig(kv: KVNamespace): Promise<PoolConfig> {
  const now = Date.now()
  if (memoryConfigCache && memoryConfigCache.expiresAt > now) {
    return memoryConfigCache.config
  }
  const raw = await kv.get<Partial<PoolConfig>>(KV_CONFIG, 'json')
  let config: PoolConfig

  if (!raw) {
    config = { ...DEFAULT_CONFIG }
  } else {
    // 兼容升级逻辑：若旧版未设 gateways
    let gateways = raw.gateways
    if (!gateways || !Array.isArray(gateways) || gateways.length === 0) {
      gateways = [...DEFAULT_GATEWAYS]
      if (raw.targetBase) {
        const first = gateways[0]!
        first.targetBase = raw.targetBase
        if (raw.defaultModel) first.defaultModel = raw.defaultModel
        if (raw.customModels) first.customModels = raw.customModels
      }
    }

    config = {
      activeGatewayId: raw.activeGatewayId || gateways[0]?.id || 'intern',
      gateways,
      adminPassword: raw.adminPassword || '',
      clientApiKey: raw.clientApiKey || '',
      autoResetDays: raw.autoResetDays || 7,
      maxRetries: raw.maxRetries || 5,
    }
  }

  memoryConfigCache = { config, expiresAt: now + 15_000 }
  return config
}

export async function saveConfig(kv: KVNamespace, config: PoolConfig): Promise<void> {
  await kv.put(KV_CONFIG, JSON.stringify(config))
  memoryConfigCache = { config, expiresAt: Date.now() + 15_000 }
}

export async function loadKeys(kv: KVNamespace): Promise<KeyItem[]> {
  const now = Date.now()
  if (memoryKeysCache && memoryKeysCache.expiresAt > now) {
    return memoryKeysCache.items
  }
  const raw = await kv.get<KeyItem[]>(KV_KEYS, 'json')
  const items = Array.isArray(raw) ? raw : []

  // 兼容老数据：如果没有 gatewayId，默认归为 'intern'
  let modified = false
  for (const k of items) {
    if (!k.gatewayId) {
      k.gatewayId = 'intern'
      modified = true
    }
  }
  if (modified) {
    await kv.put(KV_KEYS, JSON.stringify(items))
  }

  memoryKeysCache = { items, expiresAt: now + 10_000 }
  return items
}

export async function saveKeys(kv: KVNamespace, items: KeyItem[]): Promise<void> {
  await kv.put(KV_KEYS, JSON.stringify(items))
  memoryKeysCache = { items, expiresAt: Date.now() + 10_000 }
}

/** 获取指定的网关 Profile，若未指定则获取当前激活的 Profile */
export function resolveGateway(config: PoolConfig, gatewayId?: string): GatewayProfile {
  if (gatewayId) {
    const found = config.gateways.find((g) => g.id === gatewayId)
    if (found) return found
  }
  const active = config.gateways.find((g) => g.id === config.activeGatewayId)
  if (active) return active
  return config.gateways[0] || DEFAULT_GATEWAYS[0]!
}

/** 智能选号策略：根据 gatewayId 过滤，并优先从活跃池选最久未使用的 Key */
export function pickCandidateKeys(
  keys: KeyItem[],
  config: PoolConfig,
  gatewayId?: string
): KeyItem[] {
  const targetGid = gatewayId || config.activeGatewayId
  const now = Date.now()
  const resetMs = (config.autoResetDays || 7) * 24 * 60 * 60 * 1000

  // 仅选取匹配该网关的 Key
  const pool = keys.filter((k) => (k.gatewayId || 'intern') === targetGid)

  // 1. 活跃且未被禁用的 Key
  const activeKeys = pool.filter((k) => !k.disabled && k.status === 'active')
  activeKeys.sort((a, b) => (a.lastUsedAt || 0) - (b.lastUsedAt || 0))

  // 2. 超出自动恢复时间的 exhausted Key（自动复活候选）
  const autoRecoverKeys = pool.filter(
    (k) =>
      !k.disabled &&
      k.status === 'exhausted' &&
      now - (k.lastCheckedAt || k.lastUsedAt || k.addedAt) > resetMs
  )
  autoRecoverKeys.sort((a, b) => (a.lastUsedAt || 0) - (b.lastUsedAt || 0))

  // 3. 其余 exhausted Key 作为最后兜底
  const otherExhausted = pool.filter(
    (k) => !k.disabled && k.status === 'exhausted' && !autoRecoverKeys.includes(k)
  )

  return [...activeKeys, ...autoRecoverKeys, ...otherExhausted]
}

/** 向上游探测拉取最新模型列表 */
export async function fetchGatewayModels(targetBase: string, key: string): Promise<string[]> {
  const cleanBase = targetBase.replace(/\/+$/, '')
  try {
    const res = await fetch(`${cleanBase}/models`, {
      headers: { authorization: `Bearer ${key.trim()}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []
    const json = (await res.json()) as { data?: Array<{ id: string }> }
    if (Array.isArray(json.data)) {
      const ids = json.data.map((m) => m.id).filter(Boolean)
      return Array.from(new Set(ids)).sort()
    }
    return []
  } catch {
    return []
  }
}

/** 探测单张 Key 的连通性与额度 */
export async function probeKey(
  key: string,
  targetBase: string,
  model = 'deepseek-v4-flash-0731'
): Promise<{ ok: boolean; status: 'active' | 'exhausted' | 'invalid'; message: string }> {
  const cleanBase = targetBase.replace(/\/+$/, '')
  try {
    const res = await fetch(`${cleanBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key.trim()}`,
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages: [{ role: 'user', content: '1' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(12_000),
    })

    if (res.status === 200) {
      return { ok: true, status: 'active', message: '🟢 额度充足，测试正常' }
    }

    if (res.status === 401) {
      return { ok: false, status: 'invalid', message: '🔴 Key无效或已失效 (401)' }
    }

    const text = await res.text().catch(() => '')
    const lower = text.toLowerCase()

    if (
      res.status === 402 ||
      lower.includes('quota') ||
      lower.includes('credit') ||
      lower.includes('insufficient') ||
      lower.includes('余额不足') ||
      lower.includes('点数不足') ||
      lower.includes('墨点不足')
    ) {
      return { ok: false, status: 'exhausted', message: `🟡 额度/墨点已耗尽 (${res.status})` }
    }

    if (res.status === 429) {
      return { ok: false, status: 'exhausted', message: '🟡 触发限流 (429)' }
    }

    return { ok: false, status: 'exhausted', message: `HTTP ${res.status}: ${text.slice(0, 80)}` }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, status: 'exhausted', message: `网络异常: ${msg}` }
  }
}
