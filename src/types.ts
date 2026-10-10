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
  gatewayId?: string // 归属的网关 ID，如 'intern', 'deepseek', 'silicon' 等
}

export interface GatewayProfile {
  id: string
  name: string
  targetBase: string
  defaultModel: string
  customModels?: string
  fetchedModels?: string[] // 从上游 /models 探测拉取到的模型列表
  lastModelFetchAt?: number
}

export interface PoolConfig {
  activeGatewayId: string // 当前主激活网关 ID
  gateways: GatewayProfile[] // 多网关列表
  adminPassword?: string
  clientApiKey?: string
  autoResetDays: number
  maxRetries: number
  // 向后兼容旧字段
  targetBase?: string
  defaultModel?: string
  customModels?: string
}

export interface Env {
  KEY_POOL_KV: KVNamespace
  ADMIN_PASSWORD?: string
  CLIENT_API_KEY?: string
}
