export interface KeyItem {
  id: string
  key: string
  name: string
  status: 'active' | 'exhausted' | 'invalid'
  addedAt: number
  lastUsedAt?: number
  lastCheckedAt?: number
  checkMessage?: string
  failReason?: string
  failCount: number
  successCount: number
  disabled?: boolean
}

export interface PoolConfig {
  targetBase: string
  defaultModel: string
  adminPassword?: string
  clientApiKey?: string
  autoResetDays: number
  maxRetries: number
  customModels?: string
}

export interface Env {
  KEY_POOL_KV: KVNamespace
  ADMIN_PASSWORD?: string
  CLIENT_API_KEY?: string
}
