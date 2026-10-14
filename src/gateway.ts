import type { KeyItem, PoolConfig, GatewayProfile } from './types.js'
import {
  loadKeys,
  pickCandidateKeys,
  resolveGateway,
  updateKeyStatus,
  saveConfig,
  markKeyCooldown,
  recordKeySuccess,
} from './pool.js'

const STREAM_IDLE_LOG_INTERVAL_MS = 60_000
const MAX_SSE_PARSER_BUFFER = 256 * 1024
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 20_000
const MAX_RATE_LIMIT_COOLDOWN_MS = 24 * 60 * 60 * 1000

function relayLog(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({
    source: 'cf-relaypool',
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  }))
}

function getErrorType(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error && typeof error.name === 'string') {
    return error.name.slice(0, 80)
  }
  return typeof error
}

function parseRetryAfterMs(value: string | null, now = Date.now()): number | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds)) {
    const durationMs = Math.ceil(seconds * 1000)
    return durationMs > 0 ? Math.min(durationMs, MAX_RATE_LIMIT_COOLDOWN_MS) : null
  }

  const retryAt = Date.parse(value)
  if (!Number.isFinite(retryAt)) return null
  const durationMs = retryAt - now
  return durationMs > 0 ? Math.min(durationMs, MAX_RATE_LIMIT_COOLDOWN_MS) : null
}

interface StreamLogContext {
  requestId: string
  gatewayId: string
  model: string
  attempt: number
  status: number
}

interface StreamUsage {
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

function getSafeTokenLimit(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

/** Pass bytes through unchanged while recording safe streaming lifecycle metadata. */
function observeStream(
  source: ReadableStream<Uint8Array> | null,
  context: StreamLogContext
): ReadableStream<Uint8Array> | null {
  if (!source) {
    relayLog('stream_end', { ...context, outcome: 'empty_body', chunks: 0, bytes: 0 })
    return null
  }

  const reader = source.getReader()
  const decoder = new TextDecoder()
  const startedAt = Date.now()
  let lastChunkAt = startedAt
  let firstChunkAt: number | null = null
  let lastIdleLogAt = startedAt
  let maxChunkGapMs = 0
  let chunks = 0
  let bytes = 0
  let doneMarkerSeen = false
  let finishReason: string | null = null
  let usage: StreamUsage | null = null
  let parserTruncated = false
  let parserBuffer = ''
  let finished = false
  let idleTimer: ReturnType<typeof setInterval> | undefined

  const streamFields = () => ({
    ...context,
    durationMs: Date.now() - startedAt,
    firstChunkMs: firstChunkAt === null ? null : firstChunkAt - startedAt,
    maxChunkGapMs,
    chunks,
    bytes,
    finishReason,
    doneMarkerSeen,
    usage,
    parserTruncated,
  })

  function processFrame(frame: string): void {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n')
      .trim()
    if (!data) return
    if (data === '[DONE]') {
      doneMarkerSeen = true
      return
    }

    try {
      const parsed = JSON.parse(data) as {
        choices?: Array<{ finish_reason?: unknown }>
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown }
      }
      for (const choice of parsed.choices || []) {
        if (typeof choice.finish_reason === 'string') {
          finishReason = choice.finish_reason.slice(0, 80)
        }
      }
      if (parsed.usage) {
        usage = {
          promptTokens: getSafeTokenLimit(parsed.usage.prompt_tokens),
          completionTokens: getSafeTokenLimit(parsed.usage.completion_tokens),
          totalTokens: getSafeTokenLimit(parsed.usage.total_tokens),
        }
      }
    } catch {
      // Ignore non-JSON SSE frames; response bytes are still passed through unchanged.
    }
  }

  function consumeCompleteFrames(): void {
    for (;;) {
      const boundary = /\r?\n\r?\n/.exec(parserBuffer)
      if (!boundary) break
      processFrame(parserBuffer.slice(0, boundary.index))
      parserBuffer = parserBuffer.slice(boundary.index + boundary[0].length)
    }
    if (parserBuffer.length > MAX_SSE_PARSER_BUFFER) {
      parserBuffer = parserBuffer.slice(-MAX_SSE_PARSER_BUFFER)
      parserTruncated = true
    }
  }

  function finish(outcome: string, extra: Record<string, unknown> = {}): void {
    if (finished) return
    finished = true
    if (idleTimer !== undefined) clearInterval(idleTimer)
    relayLog('stream_end', { ...streamFields(), outcome, ...extra })
  }

  idleTimer = setInterval(() => {
    if (finished) return
    const now = Date.now()
    const idleMs = now - lastChunkAt
    if (idleMs < STREAM_IDLE_LOG_INTERVAL_MS || now - lastIdleLogAt < STREAM_IDLE_LOG_INTERVAL_MS) return
    lastIdleLogAt = now
    relayLog('stream_idle', { ...context, elapsedMs: now - startedAt, idleMs, chunks, bytes })
  }, STREAM_IDLE_LOG_INTERVAL_MS)

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (finished) return
      try {
        const result = await reader.read()
        if (result.done) {
          parserBuffer += decoder.decode()
          consumeCompleteFrames()
          if (parserBuffer) processFrame(parserBuffer)
          parserBuffer = ''
          const incomplete = !doneMarkerSeen && finishReason === null
          if (incomplete) {
            finish('incomplete_eof', { errorType: 'IncompleteSseStream' })
            controller.error(new Error('Upstream stream ended before a completion marker'))
          } else {
            finish('eof')
            controller.close()
          }
          return
        }

        const now = Date.now()
        const gapMs = now - lastChunkAt
        maxChunkGapMs = Math.max(maxChunkGapMs, gapMs)
        if (firstChunkAt === null) firstChunkAt = now
        lastChunkAt = now
        chunks++
        bytes += result.value.byteLength

        parserBuffer += decoder.decode(result.value, { stream: true })
        consumeCompleteFrames()
        controller.enqueue(result.value)
      } catch (error) {
        finish('read_error', { errorType: getErrorType(error) })
        controller.error(error)
      }
    },
    async cancel(reason) {
      finish('client_cancel', { cancelReasonType: getErrorType(reason) })
      await reader.cancel(reason).catch(() => {})
    },
  })
}

/** 根据请求特征解析最匹配的目标网关 Profile */
export function matchGateway(
  request: Request,
  config: PoolConfig,
  requestedModel?: string,
  explicitGatewayId?: string
): GatewayProfile {
  // 1. 显式指定的网关 ID (URL 路径参数等)
  if (explicitGatewayId && explicitGatewayId !== 'all') {
    const found = config.gateways.find((g) => g.id === explicitGatewayId)
    if (found) return found
  }

  // 2. 请求头中指定
  const headerGid = request.headers.get('x-gateway')
  if (headerGid && headerGid !== 'all') {
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
  const requestId = crypto.randomUUID()
  const requestStartedAt = Date.now()
  const contentLengthHeader = request.headers.get('content-length')
  const contentLength = contentLengthHeader && /^\d+$/.test(contentLengthHeader)
    ? Number(contentLengthHeader)
    : null
  relayLog('request_received', {
    requestId,
    contentLength,
  })

  const parseStartedAt = Date.now()
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch (error) {
    relayLog('request_parse_failed', {
      requestId,
      contentLength,
      elapsedMs: Date.now() - parseStartedAt,
      errorType: getErrorType(error),
    })
    return new Response(JSON.stringify({ error: { message: '请求体必须是合法 JSON', type: 'invalid_request_error' } }), {
      status: 400,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-relay-request-id': requestId,
      },
    })
  }
  relayLog('request_parsed', {
    requestId,
    contentLength,
    elapsedMs: Date.now() - parseStartedAt,
    messageCount: Array.isArray(body.messages) ? body.messages.length : null,
  })

  const requestedModel = typeof body.model === 'string' ? body.model : undefined
  const gateway = matchGateway(request, config, requestedModel, explicitGatewayId)

  if (!body.model && gateway.defaultModel) {
    body.model = gateway.defaultModel
  }

  const modelForLog = typeof body.model === 'string' ? body.model.slice(0, 120) : ''
  const stopSequenceCount = typeof body.stop === 'string'
    ? 1
    : Array.isArray(body.stop)
      ? body.stop.filter((item) => typeof item === 'string').length
      : 0
  const logContext = { requestId, gatewayId: gateway.id, model: modelForLog }
  relayLog('request_start', {
    ...logContext,
    streamRequested: body.stream === true,
    maxTokens: getSafeTokenLimit(body.max_tokens),
    maxCompletionTokens: getSafeTokenLimit(body.max_completion_tokens),
    stopSequenceCount,
  })

  const keysLoadStartedAt = Date.now()
  const keys = await loadKeys(kv)
  relayLog('keys_loaded', {
    ...logContext,
    keyCount: keys.length,
    durationMs: Date.now() - keysLoadStartedAt,
  })

  const candidateSelectionStartedAt = Date.now()
  const candidates = pickCandidateKeys(keys, config, gateway.id)
  relayLog('candidates_ready', {
    ...logContext,
    candidateCount: candidates.length,
    durationMs: Date.now() - candidateSelectionStartedAt,
  })

  if (candidates.length === 0) {
    relayLog('relay_no_candidates', { ...logContext, durationMs: Date.now() - requestStartedAt })
    return new Response(
      JSON.stringify({
        error: {
          message: `网关 [${gateway.name}] 下暂无可用 Key。请在管理面板为该网关导入有效的 API Key。`,
          type: 'config_error',
          code: 'no_available_keys_for_gateway',
        },
      }),
      {
        status: 503,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-relay-request-id': requestId,
        },
      }
    )
  }

  const maxAttempts = Math.min(candidates.length, config.maxRetries || 5)
  const targetBase = gateway.targetBase.replace(/\/+$/, '')
  let lastErrorMsg = '无可用 Key 响应'
  let lastUpstreamStatus: number | null = null
  let allAttemptsRateLimited = true
  let rateLimitRetryAfterMs = DEFAULT_RATE_LIMIT_COOLDOWN_MS
  relayLog('body_serialize_start', {
    ...logContext,
    messageCount: Array.isArray(body.messages) ? body.messages.length : null,
  })
  const serializeStartedAt = Date.now()
  const serializedBody = JSON.stringify(body)
  relayLog('body_serialized', {
    ...logContext,
    bodyChars: serializedBody.length,
    durationMs: Date.now() - serializeStartedAt,
  })

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = candidates[attempt]
    if (!candidate) break
    const attemptNumber = attempt + 1
    const attemptStartedAt = Date.now()
    let controller: AbortController | undefined
    let ttfbTimedOut = false

    try {
      // 客户端中断信号联动
      const attemptController = new AbortController()
      controller = attemptController
      const clientSignal = request.signal
      const onClientAbort = () => {
        attemptController.abort(clientSignal?.reason || new Error('客户端已取消请求'))
      }
      if (clientSignal) {
        if (clientSignal.aborted) {
          attemptController.abort(clientSignal.reason)
        } else {
          clientSignal.addEventListener('abort', onClientAbort, { once: true })
        }
      }

      // 首字响应超时（TTFB Timeout）：等待上游响应头限制 45 秒，响应头到达后立即清除，不再限制长文本流式耗时
      let ttfbTimer: any = setTimeout(() => {
        ttfbTimedOut = true
        attemptController.abort(new Error('上游首字响应超时 (TTFB 45s Timeout)'))
      }, 45_000)

      let upstreamRes: Response
      try {
        relayLog('upstream_attempt', { ...logContext, attempt: attemptNumber })
        upstreamRes = await fetch(`${targetBase}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${candidate.key.trim()}`,
          },
          body: serializedBody,
          signal: attemptController.signal,
        })
      } finally {
        if (ttfbTimer) {
          clearTimeout(ttfbTimer)
          ttfbTimer = null
        }
      }

      const upstreamHeadersAt = Date.now()
      lastUpstreamStatus = upstreamRes.status
      if (upstreamRes.status !== 429) allAttemptsRateLimited = false
      relayLog('upstream_headers', {
        ...logContext,
        attempt: attemptNumber,
        status: upstreamRes.status,
        ttfbMs: upstreamHeadersAt - attemptStartedAt,
      })

      // ── 成功 200 OK ──
      if (upstreamRes.status === 200) {
        // 异步安全记录调用成功与使用时间（内存秒级反映 + 节流写 KV，避免写入风暴）
        recordKeySuccess(kv, candidate.id, ctx)

        // 剥离上游有冲突的 Hop-by-hop 标头，防止客户端流式解析崩溃或截断
        const headers = new Headers()
        const HOP_BY_HOP = new Set([
          'connection',
          'keep-alive',
          'proxy-authenticate',
          'proxy-authorization',
          'te',
          'trailer',
          'transfer-encoding',
          'upgrade',
          'content-encoding',
          'content-length',
        ])
        for (const [k, v] of upstreamRes.headers.entries()) {
          if (!HOP_BY_HOP.has(k.toLowerCase())) {
            headers.set(k, v)
          }
        }
        headers.set('x-gateway-id', gateway.id)
        headers.set('x-relay-request-id', requestId)
        headers.set('x-used-key', candidate.name || candidate.id)
        headers.set('access-control-allow-origin', '*')
        headers.set('access-control-expose-headers', 'x-relay-request-id, x-gateway-id, x-used-key')

        const isStream = body.stream === true || (upstreamRes.headers.get('content-type') || '').includes('text/event-stream')
        if (isStream) {
          headers.set('content-type', 'text/event-stream; charset=utf-8')
          headers.set('cache-control', 'no-cache, no-transform')
          headers.set('connection', 'keep-alive')
          headers.set('x-accel-buffering', 'no')
        } else {
          relayLog('response_ready', {
            ...logContext,
            attempt: attemptNumber,
            status: upstreamRes.status,
            stream: false,
            durationMs: Date.now() - requestStartedAt,
          })
        }

        const responseBody = isStream
          ? observeStream(upstreamRes.body, { ...logContext, attempt: attemptNumber, status: upstreamRes.status })
          : upstreamRes.body

        return new Response(responseBody, {
          status: 200,
          headers,
        })
      }

      // ── 失败处理与毫秒级故障转移换号 ──
      const resText = await upstreamRes.text().catch(() => '')
      const lower = resText.toLowerCase()
      relayLog('upstream_rejected', {
        ...logContext,
        attempt: attemptNumber,
        status: upstreamRes.status,
        ttfbMs: upstreamHeadersAt - attemptStartedAt,
        responseChars: resText.length,
      })

      // 1. 429: 临时频率/并发限制，尊重 Retry-After；缺少时默认避让 20 秒。
      if (upstreamRes.status === 429) {
        const retryAfter = parseRetryAfterMs(upstreamRes.headers.get('retry-after'))
        const cooldownMs = retryAfter ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS
        rateLimitRetryAfterMs = Math.max(rateLimitRetryAfterMs, cooldownMs)
        markKeyCooldown(candidate.id, cooldownMs)
        candidate.failCount = (candidate.failCount || 0) + 1
        candidate.checkMessage = `临时限流 (429)，已进入${Math.ceil(cooldownMs / 1000)}秒避让冷却`
        lastErrorMsg = `Key [${candidate.name}] 触发并发限流 (429)，已换号重试`
        continue // 毫秒级换下一个可用 Key
      }

      // 2. 401: 认证失效，永久置为 invalid
      if (upstreamRes.status === 401) {
        candidate.status = 'invalid'
        candidate.failReason = '401 无效Key'
        candidate.failCount = (candidate.failCount || 0) + 1
        candidate.lastUsedAt = Date.now()
        lastErrorMsg = `Key [${candidate.name}] 认证失效 (401)`
        if (ctx) {
          ctx.waitUntil(updateKeyStatus(kv, candidate.id, {
            status: 'invalid',
            failReason: '401 无效Key',
            failCount: candidate.failCount,
            lastUsedAt: candidate.lastUsedAt,
          }))
        }
        continue // 毫秒级换下一个 Key
      }

      // 3. 402 或额度/点数真正耗尽
      if (
        upstreamRes.status === 402 ||
        lower.includes('quota') ||
        lower.includes('insufficient') ||
        lower.includes('credit') ||
        lower.includes('余额') ||
        lower.includes('点数') ||
        lower.includes('墨点')
      ) {
        candidate.status = 'exhausted'
        candidate.failReason = `${upstreamRes.status} 额度用尽`
        candidate.failCount = (candidate.failCount || 0) + 1
        candidate.lastUsedAt = Date.now()
        lastErrorMsg = `Key [${candidate.name}] 额度不足 (${upstreamRes.status})`
        if (ctx) {
          ctx.waitUntil(updateKeyStatus(kv, candidate.id, {
            status: 'exhausted',
            failReason: `${upstreamRes.status} 额度用尽`,
            failCount: candidate.failCount,
            lastUsedAt: candidate.lastUsedAt,
          }))
        }
        continue // 毫秒级换下一个 Key
      }

      candidate.failCount = (candidate.failCount || 0) + 1
      lastErrorMsg = `上游返回 HTTP ${upstreamRes.status}: ${resText.slice(0, 100)}`
      continue
    } catch (err) {
      relayLog('upstream_fetch_error', {
        ...logContext,
        attempt: attemptNumber,
        cause: request.signal.aborted
          ? 'client_abort'
          : ttfbTimedOut
            ? 'ttfb_timeout'
            : controller?.signal.aborted
              ? 'worker_abort'
              : 'fetch_error',
        errorType: getErrorType(err),
        elapsedMs: Date.now() - attemptStartedAt,
      })
      allAttemptsRateLimited = false
      lastErrorMsg = `请求超时或网络异常: ${err instanceof Error ? err.message : String(err)}`
      continue
    }
  }

  relayLog('relay_failed', {
    ...logContext,
    attempts: maxAttempts,
    lastUpstreamStatus,
    allAttemptsRateLimited,
    durationMs: Date.now() - requestStartedAt,
  })

  const rateLimited = allAttemptsRateLimited && lastUpstreamStatus === 429
  const retryAfterSeconds = Math.ceil(rateLimitRetryAfterMs / 1000)
  const failureMessage = rateLimited
    ? `上游暂时限流，已自动尝试 ${maxAttempts} 个 Key。请等待约 ${retryAfterSeconds} 秒后重试。`
    : `网关 [${gateway.name}] 已自动尝试 ${maxAttempts} 个 Key，均未成功。最后一次错误：${lastErrorMsg}。`

  return new Response(
    JSON.stringify({
      error: {
        message: failureMessage,
        type: rateLimited ? 'rate_limit_error' : 'quota_exhausted',
        code: rateLimited ? 'upstream_rate_limited' : 'all_candidate_keys_failed',
      },
    }),
    {
      status: rateLimited ? 429 : 503,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-relay-request-id': requestId,
        ...(rateLimited ? { 'retry-after': String(retryAfterSeconds) } : {}),
      },
    }
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
  const gatewayKeys = keys.filter((k) => (k.gatewayId || 'intern') === gateway.id && !k.disabled)
  const candidate = gatewayKeys.find((k) => k.status === 'active') || gatewayKeys[0]
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
