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

// 短效只读缓存（避免高并发下单节点频繁序列化，但不允许用陈旧数据覆盖写回）
let memoryKeysCache: { items: KeyItem[]; expiresAt: number } | null = null
let memoryConfigCache: { config: PoolConfig; expiresAt: number } | null = null

// 内存短期冷却表（例如 Key 触发 429 临时限流后，在内存中避让 20 秒，绝不持久化当成额度耗尽）
const keyCooldownMap = new Map<string, number>()

export function markKeyCooldown(keyId: string, durationMs = 20_000): void {
  keyCooldownMap.set(keyId, Date.now() + durationMs)
}

export function isKeyInCooldown(keyId: string): boolean {
  const expiresAt = keyCooldownMap.get(keyId)
  if (!expiresAt) return false
  if (Date.now() > expiresAt) {
    keyCooldownMap.delete(keyId)
    return false
  }
  return true
}

// 异步聚合统计更新（防 KV 写超频与竞争冲突）
let statsBatch: Record<string, { successDelta: number; lastUsedAt: number }> = {}
let lastFlushAt = 0

export async function flushKeyStats(kv: KVNamespace): Promise<void> {
  const keysToUpdate = Object.keys(statsBatch)
  if (keysToUpdate.length === 0) return

  const currentBatch = { ...statsBatch }
  statsBatch = {}
  lastFlushAt = Date.now()

  try {
    const keys = await loadKeys(kv, true)
    let hasChanges = false
    for (const id of keysToUpdate) {
      const target = keys.find((k) => k.id === id)
      const data = currentBatch[id]
      if (target && data) {
        target.successCount = (target.successCount || 0) + data.successDelta
        target.lastUsedAt = Math.max(target.lastUsedAt || 0, data.lastUsedAt)
        hasChanges = true
      }
    }
    if (hasChanges) {
      await saveKeys(kv, keys)
    }
  } catch (err) {
    console.error('[flushKeyStats] 写入统计失败:', err)
  }
}

export function recordKeySuccess(kv: KVNamespace, keyId: string, ctx?: ExecutionContext): void {
  const now = Date.now()
  if (!statsBatch[keyId]) {
    statsBatch[keyId] = { successDelta: 1, lastUsedAt: now }
  } else {
    statsBatch[keyId]!.successDelta++
    statsBatch[keyId]!.lastUsedAt = now
  }

  // 同步更新当前实例内存缓存，确保当前节点 WebUI 实时可见
  if (memoryKeysCache) {
    const memKey = memoryKeysCache.items.find((k) => k.id === keyId)
    if (memKey) {
      memKey.successCount = (memKey.successCount || 0) + 1
      memKey.lastUsedAt = now
    }
  }

  // 节流写入 KV：至少间隔 10 秒才落盘一次全量 KV，杜绝写入竞争与配额超限
  if (now - lastFlushAt > 10_000) {
    if (ctx) {
      ctx.waitUntil(flushKeyStats(kv))
    } else {
      flushKeyStats(kv).catch(() => {})
    }
  }
}

export async function loadConfig(kv: KVNamespace, forceFresh = false): Promise<PoolConfig> {
  const now = Date.now()
  if (!forceFresh && memoryConfigCache && memoryConfigCache.expiresAt > now) {
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

  memoryConfigCache = { config, expiresAt: now + 5_000 }
  return config
}

export async function saveConfig(kv: KVNamespace, config: PoolConfig): Promise<void> {
  await kv.put(KV_CONFIG, JSON.stringify(config))
  memoryConfigCache = { config, expiresAt: Date.now() + 5_000 }
}

/**
 * 加载所有 Key
 * @param forceFresh 是否强制跳过内存缓存直接从 KV 实时加载（写操作、导入、删除前必须为 true，防止多实例并发覆写！）
 */
export async function loadKeys(kv: KVNamespace, forceFresh = false): Promise<KeyItem[]> {
  const now = Date.now()
  if (!forceFresh && memoryKeysCache && memoryKeysCache.expiresAt > now) {
    // 返回副本防止原地污染
    return [...memoryKeysCache.items]
  }

  const raw = await kv.get<KeyItem[]>(KV_KEYS, 'json')
  const items = Array.isArray(raw) ? raw : []

  // 兼容老数据与自动修复历史 429 误判
  let modified = false
  for (const k of items) {
    if (!k.gatewayId) {
      k.gatewayId = 'intern'
      modified = true
    }
    if (k.failCount === undefined) k.failCount = 0
    if (k.successCount === undefined) k.successCount = 0

    // 自动修复：将历史版本因 429 临时限流被误打成 exhausted 的 Key 恢复为 active
    if (
      k.status === 'exhausted' &&
      ((k.failReason && k.failReason.includes('429')) || (k.checkMessage && k.checkMessage.includes('429')))
    ) {
      k.status = 'active'
      k.failReason = undefined
      k.checkMessage = '已自动修复：429限流解除并恢复活跃'
      modified = true
    }
  }

  if (modified) {
    await kv.put(KV_KEYS, JSON.stringify(items))
  }

  memoryKeysCache = { items, expiresAt: now + 3_000 }
  return [...items]
}

/** 保存所有 Key 到 KV，并刷新当前实例本地缓存 */
export async function saveKeys(kv: KVNamespace, items: KeyItem[]): Promise<void> {
  await kv.put(KV_KEYS, JSON.stringify(items))
  memoryKeysCache = { items: [...items], expiresAt: Date.now() + 3_000 }
}

/** 安全更新单个 Key 的状态（强一致读取最新数据后再写回，杜绝多实例陈旧快照覆盖） */
export async function updateKeyStatus(
  kv: KVNamespace,
  keyId: string,
  updates: Partial<KeyItem>
): Promise<void> {
  try {
    const freshKeys = await loadKeys(kv, true)
    const target = freshKeys.find((k) => k.id === keyId)
    if (target) {
      Object.assign(target, updates)
      await saveKeys(kv, freshKeys)
    }
  } catch (err) {
    console.error(`[updateKeyStatus] 更新 Key [${keyId}] 失败:`, err)
  }
}

/** 获取指定的网关 Profile，若未指定则获取当前激活的 Profile */
export function resolveGateway(config: PoolConfig, gatewayId?: string): GatewayProfile {
  if (gatewayId && gatewayId !== 'all') {
    const found = config.gateways.find((g) => g.id === gatewayId)
    if (found) return found
  }
  const active = config.gateways.find((g) => g.id === config.activeGatewayId)
  if (active) return active
  return config.gateways[0] || DEFAULT_GATEWAYS[0]!
}

/** Fisher-Yates 随机打乱数组（用于无状态纯内存负载均衡） */
function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = temp
  }
  return arr
}

/**
 * 智能选号策略：
 * 采用随机打乱（Fisher-Yates Shuffle）实现高性能、无状态的负载均衡。
 * 彻底废除“每次请求必须写回 KV 记录 lastUsedAt”的错误机制，
 * 在大幅提升转发速度的同时，保证 0 KV 写开销、0 并发锁冲突、0 覆写风险！
 */
export function pickCandidateKeys(
  keys: KeyItem[],
  config: PoolConfig,
  gatewayId?: string
): KeyItem[] {
  const targetGid = gatewayId && gatewayId !== 'all' ? gatewayId : config.activeGatewayId
  const now = Date.now()
  const resetMs = (config.autoResetDays || 7) * 24 * 60 * 60 * 1000

  // 1. 筛选归属于该网关且未禁用的候选 Key
  const pool = keys.filter((k) => (k.gatewayId || 'intern') === targetGid && !k.disabled)

  // 2. 活跃可用 Key：拆分为未冷却（高优先级优先调度）和冷却中（低优先级备用）
  const activeKeys = pool.filter((k) => k.status === 'active')
  const readyActive = activeKeys.filter((k) => !isKeyInCooldown(k.id))
  const coolingActive = activeKeys.filter((k) => isKeyInCooldown(k.id))
  shuffleArray(readyActive)
  shuffleArray(coolingActive)

  // 3. 超出自动恢复时间的 exhausted Key（自动复活候选）
  const autoRecoverKeys = pool.filter(
    (k) =>
      k.status === 'exhausted' &&
      now - (k.lastCheckedAt || k.lastUsedAt || k.addedAt) > resetMs
  )
  shuffleArray(autoRecoverKeys)

  // 4. 其余 exhausted Key 作为最后兜底
  const otherExhausted = pool.filter(
    (k) => k.status === 'exhausted' && !autoRecoverKeys.includes(k)
  )
  shuffleArray(otherExhausted)

  return [...readyActive, ...coolingActive, ...autoRecoverKeys, ...otherExhausted]
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
      return { ok: true, status: 'active', message: '🟡 触发并发限流 (429)，Key有效' }
    }

    if (res.status === 404 || lower.includes('model_not_found') || lower.includes('does not exist')) {
      return { ok: false, status: 'invalid', message: `🔴 测试模型 [${model}] 不存在或不可用 (404)` }
    }

    return { ok: false, status: 'exhausted', message: `HTTP ${res.status}: ${text.slice(0, 80)}` }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, status: 'exhausted', message: `网络异常: ${msg}` }
  }
}
