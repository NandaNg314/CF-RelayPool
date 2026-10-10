import type { KeyItem, PoolConfig } from './types.js'

export const DEFAULT_CONFIG: PoolConfig = {
  targetBase: 'https://discovery-api.intern-ai.org.cn/v1',
  defaultModel: 'deepseek-v4-flash-0731',
  adminPassword: '',
  clientApiKey: '',
  autoResetDays: 7, // 默认 7 天自动尝试复活/重置状态
  maxRetries: 5,
}

const KV_KEYS = 'key_pool_items'
const KV_CONFIG = 'key_pool_config'

/** 内存极简短期缓存（避免单个 isolate 多次读取 KV 产生配额） */
let memoryKeysCache: { items: KeyItem[]; expiresAt: number } | null = null
let memoryConfigCache: { config: PoolConfig; expiresAt: number } | null = null

export async function loadConfig(kv: KVNamespace): Promise<PoolConfig> {
  const now = Date.now()
  if (memoryConfigCache && memoryConfigCache.expiresAt > now) {
    return memoryConfigCache.config
  }
  const raw = await kv.get(KV_CONFIG, 'json')
  const config = { ...DEFAULT_CONFIG, ...(raw as Partial<PoolConfig> || {}) }
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
  memoryKeysCache = { items, expiresAt: now + 10_000 }
  return items
}

export async function saveKeys(kv: KVNamespace, items: KeyItem[]): Promise<void> {
  await kv.put(KV_KEYS, JSON.stringify(items))
  memoryKeysCache = { items, expiresAt: Date.now() + 10_000 }
}

/** 智能选号策略：优先从活跃池选最久未使用的 Key */
export function pickCandidateKeys(keys: KeyItem[], config: PoolConfig): KeyItem[] {
  const now = Date.now()
  const resetMs = (config.autoResetDays || 7) * 24 * 60 * 60 * 1000

  // 1. 活跃且未被禁用的 Key
  const activeKeys = keys.filter((k) => !k.disabled && k.status === 'active')
  activeKeys.sort((a, b) => (a.lastUsedAt || 0) - (b.lastUsedAt || 0))

  // 2. 超出自动恢复时间的 exhausted Key（自动复活候选）
  const autoRecoverKeys = keys.filter(
    (k) =>
      !k.disabled
      && k.status === 'exhausted'
      && (now - (k.lastCheckedAt || k.lastUsedAt || k.addedAt) > resetMs)
  )
  autoRecoverKeys.sort((a, b) => (a.lastUsedAt || 0) - (b.lastUsedAt || 0))

  // 3. 其余 exhausted Key 作为最后兜底
  const otherExhausted = keys.filter(
    (k) => !k.disabled && k.status === 'exhausted' && !autoRecoverKeys.includes(k)
  )

  return [...activeKeys, ...autoRecoverKeys, ...otherExhausted]
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
        model,
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
