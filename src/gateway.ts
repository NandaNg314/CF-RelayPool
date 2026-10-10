import type { KeyItem, PoolConfig } from './types.js'
import { loadKeys, pickCandidateKeys, saveKeys } from './pool.js'

export async function handleChatCompletions(
  request: Request,
  kv: KVNamespace,
  config: PoolConfig,
  ctx?: ExecutionContext
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

  const keys = await loadKeys(kv)
  if (keys.length === 0) {
    return new Response(
      JSON.stringify({
        error: {
          message: 'Key 池目前为空，请在管理面板导入至少一个有效 API Key。',
          type: 'config_error',
          code: 'no_keys_in_pool',
        },
      }),
      { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } }
    )
  }

  const candidates = pickCandidateKeys(keys, config)
  if (candidates.length === 0) {
    return new Response(
      JSON.stringify({
        error: {
          message: '池中所有 Key 均已停用或失效，请在面板检查 Key 状态或添加新 Key。',
          type: 'quota_exhausted',
          code: 'all_keys_disabled',
        },
      }),
      { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } }
    )
  }

  const maxAttempts = Math.min(candidates.length, config.maxRetries || 5)
  const targetBase = config.targetBase.replace(/\/+$/, '')
  const isStream = body.stream === true
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

        // 透传 headers，尤其是流式 SSE headers
        const headers = new Headers(upstreamRes.headers)
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

      // 其它上游服务端故障 (5xx 等)
      lastErrorMsg = `上游返回 HTTP ${upstreamRes.status}: ${resText.slice(0, 100)}`
      continue
    } catch (err) {
      lastErrorMsg = `请求超时或网络异常: ${err instanceof Error ? err.message : String(err)}`
      continue
    }
  }

  // 若状态变更，在后台异步存入 KV
  if (keysChanged) {
    const promise = saveKeys(kv, keys)
    if (ctx) ctx.waitUntil(promise)
  }

  return new Response(
    JSON.stringify({
      error: {
        message: `已自动尝试 ${maxAttempts} 个 Key，均未成功。最后一次错误：${lastErrorMsg}。`,
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
  config: PoolConfig
): Promise<Response> {
  const keys = await loadKeys(kv)
  const candidate = keys.find((k) => !k.disabled && k.status === 'active') || keys[0]
  const targetBase = config.targetBase.replace(/\/+$/, '')

  if (!candidate) {
    return new Response(JSON.stringify({ object: 'list', data: [] }), {
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const res = await fetch(`${targetBase}/models`, {
      headers: { authorization: `Bearer ${candidate.key.trim()}` },
      signal: AbortSignal.timeout(10_000),
    })
    return new Response(res.body, {
      status: res.status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
    })
  } catch (e) {
    return new Response(
      JSON.stringify({
        object: 'list',
        data: [{ id: config.defaultModel, object: 'model', owned_by: 'intern-ai' }],
      }),
      { headers: { 'content-type': 'application/json' } }
    )
  }
}
