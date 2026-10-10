import type { KeyItem, PoolConfig, GatewayProfile } from './types.js'
import { loadKeys, pickCandidateKeys, resolveGateway, saveKeys, saveConfig } from './pool.js'

/** 根据请求特征解析最匹配的目标网关 Profile */
export function matchGateway(
  request: Request,
  config: PoolConfig,
  requestedModel?: string,
  explicitGatewayId?: string
): GatewayProfile {
  // 1. 显式指定的网关 ID (URL 路径参数等)
  if (explicitGatewayId) {
    const found = config.gateways.find((g) => g.id === explicitGatewayId)
    if (found) return found
  }

  // 2. 请求头中指定
  const headerGid = request.headers.get('x-gateway')
  if (headerGid) {
    const found = config.gateways.find((g) => g.id === headerGid)
    if (found) return found
  }

  // 3. 根据 model 名称智能自动匹配归属网关
  if (requestedModel) {
    const matched = config.gateways.find((g) => {
      if (g.defaultModel === requestedModel) return true
      if (g.fetchedModels && g.fetchedModels.includes(requestedModel)) return true
      if (g.customModels && g.customModels.split(',').map((m) => m.trim()).includes(requestedModel)) return true
      return false
    })
    if (matched) return matched
  }

  // 4. 默认返回当前激活的主网关
  return resolveGateway(config)
}

export async function handleChatCompletions(
  request: Request,
  kv: KVNamespace,
  config: PoolConfig,
  ctx?: ExecutionContext,
  explicitGatewayId?: string
): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return new Response(JSON.stringify({ error: { message: '请求体必须是合法 JSON', type: 'invalid_request_error' } }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }

  const requestedModel = typeof body.model === 'string' ? body.model : undefined
  const gateway = matchGateway(request, config, requestedModel, explicitGatewayId)

  if (!body.model && gateway.defaultModel) {
    body.model = gateway.defaultModel
  }

  const keys = await loadKeys(kv)
  const candidates = pickCandidateKeys(keys, config, gateway.id)

  if (candidates.length === 0) {
    return new Response(
      JSON.stringify({
        error: {
          message: `网关 [${gateway.name}] 下暂无可用 Key。请在管理面板为该网关导入有效的 API Key。`,
          type: 'config_error',
          code: 'no_available_keys_for_gateway',
        },
      }),
      { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } }
    )
  }

  const maxAttempts = Math.min(candidates.length, config.maxRetries || 5)
  const targetBase = gateway.targetBase.replace(/\/+$/, '')
  let lastErrorMsg = '无可用 Key 响应'
  let keysChanged = false

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = candidates[attempt]
    if (!candidate) break

    try {
      const upstreamRes = await fetch(`${targetBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${candidate.key.trim()}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      })

      // ── 成功 200 OK ──
      if (upstreamRes.status === 200) {
        candidate.lastUsedAt = Date.now()
        candidate.successCount = (candidate.successCount || 0) + 1
        candidate.status = 'active'
        keysChanged = true

        if (keysChanged) {
          const promise = saveKeys(kv, keys)
          if (ctx) ctx.waitUntil(promise)
        }

        const headers = new Headers(upstreamRes.headers)
        headers.set('x-gateway-id', gateway.id)
        headers.set('x-used-key', `${candidate.name || candidate.id} (${candidate.key.slice(0, 7)}...${candidate.key.slice(-4)})`)
        headers.set('access-control-allow-origin', '*')

        return new Response(upstreamRes.body, {
          status: 200,
          headers,
        })
      }

      // ── 失败处理与自动换号 ──
      const resText = await upstreamRes.text().catch(() => '')
      const lower = resText.toLowerCase()
      candidate.lastUsedAt = Date.now()
      candidate.failCount = (candidate.failCount || 0) + 1

      if (upstreamRes.status === 401) {
        candidate.status = 'invalid'
        candidate.failReason = '401 无效Key'
        lastErrorMsg = `Key [${candidate.name}] 认证失效 (401)`
        keysChanged = true
        continue // 毫秒级换下一个 Key
      }

      if (
        upstreamRes.status === 402 ||
        upstreamRes.status === 429 ||
        lower.includes('quota') ||
        lower.includes('insufficient') ||
        lower.includes('credit') ||
        lower.includes('余额') ||
        lower.includes('点数') ||
        lower.includes('墨点')
      ) {
        candidate.status = 'exhausted'
        candidate.failReason = `${upstreamRes.status} 额度用尽/限流`
        lastErrorMsg = `Key [${candidate.name}] 额度不足或限流 (${upstreamRes.status})`
        keysChanged = true
        continue // 毫秒级换下一个 Key
      }

      lastErrorMsg = `上游返回 HTTP ${upstreamRes.status}: ${resText.slice(0, 100)}`
      continue
    } catch (err) {
      lastErrorMsg = `请求超时或网络异常: ${err instanceof Error ? err.message : String(err)}`
      continue
    }
  }

  if (keysChanged) {
    const promise = saveKeys(kv, keys)
    if (ctx) ctx.waitUntil(promise)
  }

  return new Response(
    JSON.stringify({
      error: {
        message: `网关 [${gateway.name}] 已自动尝试 ${maxAttempts} 个 Key，均未成功。最后一次错误：${lastErrorMsg}。`,
        type: 'quota_exhausted',
        code: 'all_candidate_keys_failed',
      },
    }),
    { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } }
  )
}

export async function handleModels(
  request: Request,
  kv: KVNamespace,
  config: PoolConfig,
  ctx?: ExecutionContext,
  explicitGatewayId?: string
): Promise<Response> {
  const gateway = matchGateway(request, config, undefined, explicitGatewayId)
  const keys = await loadKeys(kv)
  const candidate = keys.find((k) => (k.gatewayId || 'intern') === gateway.id && !k.disabled && k.status === 'active') || keys[0]
  const targetBase = gateway.targetBase.replace(/\/+$/, '')

  if (candidate) {
    try {
      const res = await fetch(`${targetBase}/models`, {
        headers: { authorization: `Bearer ${candidate.key.trim()}` },
        signal: AbortSignal.timeout(10_000),
      })
      if (res.ok) {
        const json = (await res.json()) as { object?: string; data?: Array<{ id: string }> }
        if (Array.isArray(json.data) && json.data.length > 0) {
          // 异步缓存探测到的最新模型列表
          const ids = json.data.map((m) => m.id).filter(Boolean)
          gateway.fetchedModels = Array.from(new Set(ids)).sort()
          gateway.lastModelFetchAt = Date.now()
          if (ctx) ctx.waitUntil(saveConfig(kv, config))
        }
        return new Response(JSON.stringify(json), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
        })
      }
    } catch {}
  }

  // 兜底返回该网关配置的模型列表
  const fallbackList = Array.from(
    new Set([
      ...(gateway.fetchedModels || []),
      ...(gateway.customModels ? gateway.customModels.split(',').map((m) => m.trim()) : []),
      gateway.defaultModel,
    ].filter(Boolean))
  )

  return new Response(
    JSON.stringify({
      object: 'list',
      data: fallbackList.map((m) => ({ id: m, object: 'model', created: 1700000000, owned_by: gateway.id })),
    }),
    { headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' } }
  )
}
