import type { Env, KeyItem, PoolConfig, GatewayProfile } from './types.js'
import {
  DEFAULT_CONFIG,
  fetchGatewayModels,
  loadConfig,
  loadKeys,
  pickCandidateKeys,
  probeKey,
  resolveGateway,
  saveConfig,
  saveKeys,
  updateKeyStatus,
} from './pool.js'
import { handleChatCompletions, handleModels } from './gateway.js'
import { UI_HTML } from './ui.js'

function corsHeaders(): Headers {
  const h = new Headers()
  h.set('access-control-allow-origin', '*')
  h.set('access-control-allow-methods', 'GET, POST, OPTIONS, PUT, DELETE')
  h.set('access-control-allow-headers', '*')
  return h
}

function jsonResponse(data: unknown, status = 200): Response {
  const headers = corsHeaders()
  headers.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(data), { status, headers })
}

/** 校验管理权限 */
function verifyAdmin(request: Request, config: PoolConfig, env: Env): boolean {
  const expected = env.ADMIN_PASSWORD || config.adminPassword
  if (!expected) return true

  const headerKey = request.headers.get('x-admin-key')
  if (headerKey && headerKey === expected) return true

  const url = new URL(request.url)
  const queryKey = url.searchParams.get('key')
  if (queryKey && queryKey === expected) return true

  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    if (authHeader.slice(7).trim() === expected) return true
  }

  return false
}

/** 校验客户端调用权限 */
function verifyClient(request: Request, config: PoolConfig, env: Env): boolean {
  const expected = env.CLIENT_API_KEY || config.clientApiKey
  if (!expected) return true

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }
  return authHeader.slice(7).trim() === expected
}

/** 智能识别字符串是否更符合 API Key 的特征（长度、字符集、sk/eyJ前缀等） */
function isLikelyKey(str: string): boolean {
  if (!str) return false
  const s = str.trim()
  if (s.startsWith('sk-') || s.startsWith('eyJ') || s.startsWith('Bearer ') || s.startsWith('key-')) {
    return true
  }
  // 含有中文、制表符或换行的肯定不是 Key
  if (/[\u4e00-\u9fa5\s]/.test(s)) {
    return false
  }
  // 长度符合常见 key 且为纯字母数字下划线减号点
  if (s.length >= 10 && /^[A-Za-z0-9_.-]+$/.test(s)) {
    return true
  }
  return false
}

/** 智能解析导入文本，支持 JSON、----、逗号、冒号、制表符Tab、空格等全部格式 */
export function parseImportLines(text: string): Array<{ key: string; name: string }> {
  const trimmed = text.trim()
  if (!trimmed) return []

  const results: Array<{ key: string; name: string }> = []
  const seenKeys = new Set<string>()

  function addResult(rawKey: string, rawName: string) {
    let key = rawKey.trim().replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim()
    let name = rawName.trim().replace(/^["']|["']$/g, '').trim()
    if (!key || key.length < 6) return
    if (seenKeys.has(key)) return
    seenKeys.add(key)
    if (!name) {
      name = key.length > 10 ? `Key-${key.slice(0, 4)}...${key.slice(-4)}` : `Key-${key}`
    }
    results.push({ key, name })
  }

  // 1. 尝试直接作为 JSON 解析
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsedJson = JSON.parse(trimmed)
      if (Array.isArray(parsedJson)) {
        for (const item of parsedJson) {
          if (typeof item === 'string') {
            addResult(item, '')
          } else if (item && typeof item === 'object') {
            const obj = item as Record<string, unknown>
            const k = String(obj.key || obj.apiKey || obj.api_key || obj.token || '')
            const n = String(obj.name || obj.remark || obj.title || '')
            if (k) addResult(k, n)
          }
        }
        if (results.length > 0) return results
      }
    } catch {}
  }

  // 2. 按行解析
  const lines = text.split(/\r?\n/)
  for (let line of lines) {
    line = line.trim()
    if (!line || line.startsWith('#') || line.startsWith('//')) continue

    // 检查该行是否包含了多个用逗号/分号隔开的独立 sk-xxxx 密钥
    const multiSkMatches = line.match(/sk-[A-Za-z0-9_-]{10,}/g)
    if (multiSkMatches && multiSkMatches.length > 1) {
      for (const sk of multiSkMatches) {
        addResult(sk, '')
      }
      continue
    }

    let key = ''
    let name = ''

    // 分隔符判断优先级：---- > 制表符 \t > 逗号 , > 冒号 : / ： > 空格
    if (line.includes('----')) {
      const parts = line.split('----')
      const p1 = parts[0]!.trim()
      const p2 = parts.slice(1).join('----').trim()
      if (isLikelyKey(p1) && !isLikelyKey(p2)) {
        key = p1; name = p2
      } else if (isLikelyKey(p2) && !isLikelyKey(p1)) {
        key = p2; name = p1
      } else if (p1.startsWith('sk-')) {
        key = p1; name = p2
      } else {
        key = p2; name = p1
      }
    } else if (line.includes('\t')) {
      const parts = line.split('\t').filter(Boolean)
      const p1 = parts[0]?.trim() || ''
      const p2 = parts.slice(1).join(' ').trim()
      if (isLikelyKey(p1) && !isLikelyKey(p2)) {
        key = p1; name = p2
      } else {
        key = p2; name = p1
      }
    } else if (line.includes(',')) {
      const parts = line.split(',')
      const p1 = parts[0]!.trim()
      const p2 = parts.slice(1).join(',').trim()
      if (isLikelyKey(p1) && !isLikelyKey(p2)) {
        key = p1; name = p2
      } else if (isLikelyKey(p2) && !isLikelyKey(p1)) {
        key = p2; name = p1
      } else if (p1.startsWith('sk-')) {
        key = p1; name = p2
      } else {
        key = p1; name = p2
      }
    } else if (line.includes(':') || line.includes('：')) {
      const sep = line.includes(':') ? ':' : '：'
      const parts = line.split(sep)
      const p1 = parts[0]!.trim()
      const p2 = parts.slice(1).join(sep).trim()
      if (isLikelyKey(p1) && !isLikelyKey(p2)) {
        key = p1; name = p2
      } else {
        key = p2; name = p1
      }
    } else if (/\s+/.test(line)) {
      const parts = line.split(/\s+/)
      const skIndex = parts.findIndex((p) => isLikelyKey(p))
      if (skIndex !== -1) {
        key = parts[skIndex]!
        name = parts.filter((_, i) => i !== skIndex).join(' ')
      } else {
        key = parts[0]!
        name = parts.slice(1).join(' ')
      }
    } else {
      key = line
    }

    addResult(key, name)
  }

  return results
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() })
    }

    const url = new URL(request.url)
    const pathname = url.pathname

    // ── 1. WebUI 界面 ──
    if (pathname === '/' || pathname === '/panel' || pathname === '/index.html') {
      const headers = new Headers()
      headers.set('content-type', 'text/html; charset=utf-8')
      headers.set('cache-control', 'no-cache')
      return new Response(UI_HTML, { headers })
    }

    const config = await loadConfig(env.KEY_POOL_KV)

    // ── 2. 管理 API (/admin/api/*) ──
    if (pathname.startsWith('/admin/api/')) {
      if (!verifyAdmin(request, config, env)) {
        return jsonResponse({ error: '未授权：管理密码错误或缺失' }, 401)
      }

      // 获取状态与列表（强制读取最新数据，杜绝旧缓存）
      if (pathname === '/admin/api/status' && request.method === 'GET') {
        const keys = await loadKeys(env.KEY_POOL_KV, true)
        const safeConfig = {
          ...config,
          adminPassword: config.adminPassword || env.ADMIN_PASSWORD ? '******' : '',
          clientApiKey: config.clientApiKey || env.CLIENT_API_KEY || '',
        }
        return jsonResponse({ keys, config: safeConfig })
      }

      // 切换主激活网关
      if (pathname === '/admin/api/gateways/active' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as { id?: string }
        if (!body.id) return jsonResponse({ error: '缺少网关 id' }, 400)
        const gw = config.gateways.find((g) => g.id === body.id)
        if (!gw) return jsonResponse({ error: '未找到指定网关' }, 404)
        config.activeGatewayId = gw.id
        await saveConfig(env.KEY_POOL_KV, config)
        return jsonResponse({ ok: true, activeGatewayId: gw.id })
      }

      // 新增或更新网关 Profile
      if (pathname === '/admin/api/gateways/save' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as { gateway?: Partial<GatewayProfile> }
        const gwData = body.gateway
        if (!gwData || !gwData.id || !gwData.targetBase) {
          return jsonResponse({ error: '网关 id 与 targetBase 为必填项' }, 400)
        }

        const id = gwData.id.trim()
        const existingIdx = config.gateways.findIndex((g) => g.id === id)
        const profile: GatewayProfile = {
          id,
          name: gwData.name?.trim() || id,
          targetBase: gwData.targetBase.trim().replace(/\/+$/, ''),
          defaultModel: gwData.defaultModel?.trim() || 'deepseek-chat',
          customModels: gwData.customModels?.trim() || '',
          fetchedModels: gwData.fetchedModels || [],
          lastModelFetchAt: gwData.lastModelFetchAt || Date.now(),
        }

        if (existingIdx !== -1) {
          if (!profile.fetchedModels || profile.fetchedModels.length === 0) {
            profile.fetchedModels = config.gateways[existingIdx]?.fetchedModels || []
          }
          config.gateways[existingIdx] = profile
        } else {
          config.gateways.push(profile)
        }

        await saveConfig(env.KEY_POOL_KV, config)
        return jsonResponse({ ok: true, gateway: profile })
      }

      // 删除网关
      if (pathname === '/admin/api/gateways/delete' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as { id?: string }
        if (!body.id) return jsonResponse({ error: '缺少网关 id' }, 400)
        if (config.gateways.length <= 1) {
          return jsonResponse({ error: '不能删除最后一个网关' }, 400)
        }

        config.gateways = config.gateways.filter((g) => g.id !== body.id)
        if (config.activeGatewayId === body.id) {
          config.activeGatewayId = config.gateways[0]!.id
        }
        await saveConfig(env.KEY_POOL_KV, config)
        return jsonResponse({ ok: true, activeGatewayId: config.activeGatewayId })
      }

      // 动态向网关上游探测并获取可用模型列表
      if (pathname === '/admin/api/gateways/fetch-models' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as { id?: string }
        const gw = resolveGateway(config, body.id)
        const keys = await loadKeys(env.KEY_POOL_KV, true)
        const candidate = keys.find((k) => (k.gatewayId || 'intern') === gw.id && !k.disabled && k.status === 'active') || keys.find((k) => (k.gatewayId || 'intern') === gw.id)

        if (!candidate) {
          return jsonResponse({ error: `网关 [${gw.name}] 尚未导入 Key，无法向上游探测模型列表。` }, 400)
        }

        const models = await fetchGatewayModels(gw.targetBase, candidate.key)
        if (models.length > 0) {
          gw.fetchedModels = models
          gw.lastModelFetchAt = Date.now()
          await saveConfig(env.KEY_POOL_KV, config)
          return jsonResponse({ ok: true, models, count: models.length })
        } else {
          return jsonResponse({
            ok: false,
            message: '上游未提供公开的 /models 列表，已保留当前配置模型',
            models: gw.fetchedModels || [gw.defaultModel],
          })
        }
      }

      // 导入 Keys (支持指定 gatewayId，强制从 KV 实时拉取最新列表合并追加)
      if (pathname === '/admin/api/keys/import' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as { text?: string; gatewayId?: string }
        if (!body.text) return jsonResponse({ error: '导入文本不能为空' }, 400)

        const parsed = parseImportLines(body.text)
        if (parsed.length === 0) return jsonResponse({ error: '未在文本中解析到有效 Key（Key 需至少 6 位字符）' }, 400)

        const targetGid = (body.gatewayId && body.gatewayId !== 'all') ? body.gatewayId : config.activeGatewayId
        // 关键安全保证：必须 forceFresh 实时从 KV 加载，绝不使用内存陈旧缓存！
        const keys = await loadKeys(env.KEY_POOL_KV, true)
        let importedCount = 0
        let ignoredCount = 0

        for (const item of parsed) {
          const existing = keys.find((k) => k.key.trim() === item.key.trim() && (k.gatewayId || 'intern') === targetGid)
          if (existing) {
            ignoredCount++
            if (item.name && (!existing.name || existing.name.startsWith('Key-'))) {
              existing.name = item.name
            }
          } else {
            keys.push({
              id: 'k_' + crypto.randomUUID().slice(0, 8),
              key: item.key.trim(),
              name: item.name,
              status: 'active',
              gatewayId: targetGid,
              addedAt: Date.now(),
              failCount: 0,
              successCount: 0,
            })
            importedCount++
          }
        }

        await saveKeys(env.KEY_POOL_KV, keys)
        return jsonResponse({ ok: true, importedCount, ignoredCount, totalCount: keys.length, gatewayId: targetGid })
      }

      // 测活 Keys (单张或安全分批测活，彻底规避 CF Workers 50 子请求限制)
      if (pathname === '/admin/api/keys/probe' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as {
          id?: string
          all?: boolean
          gatewayId?: string
          offset?: number
          limit?: number
        }
        const keys = await loadKeys(env.KEY_POOL_KV, true)

        if (body.id) {
          const keyItem = keys.find((k) => k.id === body.id)
          if (!keyItem) return jsonResponse({ error: '未找到指定 Key' }, 404)

          const gw = resolveGateway(config, keyItem.gatewayId)
          const res = await probeKey(keyItem.key, gw.targetBase, gw.defaultModel)
          keyItem.status = res.status
          keyItem.lastCheckedAt = Date.now()
          keyItem.checkMessage = res.message
          if (res.status === 'active') {
            keyItem.failCount = 0
          }
          await saveKeys(env.KEY_POOL_KV, keys)
          return jsonResponse({ ok: true, message: res.message, status: res.status })
        }

        if (body.all) {
          const targetGid = body.gatewayId
          const targetKeys = keys.filter((k) => {
            if (targetGid && targetGid !== 'all') {
              return (k.gatewayId || 'intern') === targetGid
            }
            return true
          })

          // 安全分批：每次最多测活 25 个，绝不超出 Cloudflare 50 次 fetch 限制
          const offset = Math.max(0, body.offset || 0)
          const limit = Math.min(Math.max(1, body.limit || 25), 30)
          const batchSlice = targetKeys.slice(offset, offset + limit)

          let activeCount = 0
          let exhaustedCount = 0
          let invalidCount = 0

          const concurrency = 3
          for (let i = 0; i < batchSlice.length; i += concurrency) {
            const chunk = batchSlice.slice(i, i + concurrency)
            await Promise.all(
              chunk.map(async (k) => {
                if (k.disabled) return
                const gw = resolveGateway(config, k.gatewayId)
                const res = await probeKey(k.key, gw.targetBase, gw.defaultModel)
                k.status = res.status
                k.lastCheckedAt = Date.now()
                k.checkMessage = res.message
                if (res.status === 'active') {
                  k.failCount = 0
                  activeCount++
                } else if (res.status === 'exhausted') {
                  exhaustedCount++
                } else {
                  invalidCount++
                }
              })
            )
          }

          // 重新从 KV 加载最新状态再合并，杜绝覆写期间其他实例新增的 Key
          const freshKeys = await loadKeys(env.KEY_POOL_KV, true)
          for (const updated of batchSlice) {
            const found = freshKeys.find((k) => k.id === updated.id)
            if (found) {
              found.status = updated.status
              found.lastCheckedAt = updated.lastCheckedAt
              found.checkMessage = updated.checkMessage
              found.failCount = updated.failCount
            }
          }
          await saveKeys(env.KEY_POOL_KV, freshKeys)

          return jsonResponse({
            ok: true,
            activeCount,
            exhaustedCount,
            invalidCount,
            probedInBatch: batchSlice.length,
            offset,
            limit,
            totalKeys: targetKeys.length,
            hasMore: offset + limit < targetKeys.length,
            nextOffset: offset + limit,
          })
        }

        return jsonResponse({ error: '参数错误，必须传入 id 或 all' }, 400)
      }

      // 复活/重置状态
      if (pathname === '/admin/api/keys/revive' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as { id?: string; all?: boolean; gatewayId?: string }
        const keys = await loadKeys(env.KEY_POOL_KV, true)
        let revivedCount = 0

        if (body.id) {
          const keyItem = keys.find((k) => k.id === body.id)
          if (!keyItem) return jsonResponse({ error: '未找到指定 Key' }, 404)
          keyItem.status = 'active'
          keyItem.failCount = 0
          keyItem.checkMessage = '手动重置为活跃状态'
          await saveKeys(env.KEY_POOL_KV, keys)
          return jsonResponse({ ok: true })
        }

        if (body.all) {
          const targetGid = body.gatewayId
          for (const k of keys) {
            if (targetGid && targetGid !== 'all' && (k.gatewayId || 'intern') !== targetGid) continue
            if (k.status === 'exhausted') {
              k.status = 'active'
              k.failCount = 0
              k.checkMessage = '手动一键全量复活'
              revivedCount++
            }
          }
          await saveKeys(env.KEY_POOL_KV, keys)
          return jsonResponse({ ok: true, revivedCount })
        }

        return jsonResponse({ error: '参数错误' }, 400)
      }

      // 一键清理失效 401 Key
      if (pathname === '/admin/api/keys/clean-invalid' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as { gatewayId?: string }
        let keys = await loadKeys(env.KEY_POOL_KV, true)
        const initialCount = keys.length
        const targetGid = body.gatewayId

        keys = keys.filter((k) => {
          if (targetGid && targetGid !== 'all' && (k.gatewayId || 'intern') !== targetGid) {
            return true
          }
          return k.status !== 'invalid'
        })

        const deletedCount = initialCount - keys.length
        if (deletedCount > 0) {
          await saveKeys(env.KEY_POOL_KV, keys)
        }
        return jsonResponse({ ok: true, deletedCount, remainingCount: keys.length })
      }

      // 启用/停用 Key
      if (pathname === '/admin/api/keys/toggle' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as { id?: string }
        const keys = await loadKeys(env.KEY_POOL_KV, true)
        const keyItem = keys.find((k) => k.id === body.id)
        if (!keyItem) return jsonResponse({ error: '未找到指定 Key' }, 404)

        keyItem.disabled = !keyItem.disabled
        await saveKeys(env.KEY_POOL_KV, keys)
        return jsonResponse({ ok: true, disabled: keyItem.disabled })
      }

      // 删除 Key
      if (pathname === '/admin/api/keys/delete' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as { id?: string }
        let keys = await loadKeys(env.KEY_POOL_KV, true)
        const initialLen = keys.length
        keys = keys.filter((k) => k.id !== body.id)
        if (keys.length === initialLen) return jsonResponse({ error: '未找到指定 Key' }, 404)

        await saveKeys(env.KEY_POOL_KV, keys)
        return jsonResponse({ ok: true })
      }

      // 保存全局配置 (如重试次数、密码、API Key 等)
      if (pathname === '/admin/api/config' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as Partial<PoolConfig>
        const updated: PoolConfig = {
          ...config,
          maxRetries: Number.isFinite(body.maxRetries) ? Math.max(1, body.maxRetries!) : config.maxRetries,
          autoResetDays: Number.isFinite(body.autoResetDays) ? Math.max(1, body.autoResetDays!) : config.autoResetDays,
          clientApiKey: body.clientApiKey !== undefined ? body.clientApiKey.trim() : config.clientApiKey,
        }
        if (body.adminPassword !== undefined) {
          updated.adminPassword = body.adminPassword.trim()
        }
        await saveConfig(env.KEY_POOL_KV, updated)
        return jsonResponse({ ok: true })
      }

      return jsonResponse({ error: '未知的管理接口' }, 404)
    }

    // ── 3. OpenAI 兼容网关 (/v1/* 或 /:gatewayId/v1/*) ──
    const matchGatewayPrefix = pathname.match(/^\/([a-zA-Z0-9_-]+)\/v1\/(chat\/completions|models)$/)
    let targetGatewayId: string | undefined
    let subRoute = ''

    if (matchGatewayPrefix) {
      targetGatewayId = matchGatewayPrefix[1]
      subRoute = matchGatewayPrefix[2]!
    } else if (pathname === '/v1/chat/completions') {
      subRoute = 'chat/completions'
    } else if (pathname === '/v1/models') {
      subRoute = 'models'
    }

    if (subRoute) {
      if (!verifyClient(request, config, env)) {
        return jsonResponse(
          { error: { message: '未授权：客户端 API Key 无效或缺失', type: 'authentication_error' } },
          401
        )
      }

      if (subRoute === 'chat/completions') {
        return handleChatCompletions(request, env.KEY_POOL_KV, config, ctx, targetGatewayId)
      }
      if (subRoute === 'models') {
        return handleModels(request, env.KEY_POOL_KV, config, ctx, targetGatewayId)
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders() })
  },

  // ── 4. 定时 Cron：自动复活到期的 exhausted Key ──
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const config = await loadConfig(env.KEY_POOL_KV, true)
    const keys = await loadKeys(env.KEY_POOL_KV, true)
    const resetMs = (config.autoResetDays || 7) * 24 * 60 * 60 * 1000
    const now = Date.now()

    let recovered = 0
    for (const k of keys) {
      if (k.disabled) continue
      if (k.status === 'exhausted') {
        const lastActivity = k.lastCheckedAt || k.lastUsedAt || k.addedAt
        if (now - lastActivity > resetMs) {
          k.status = 'active'
          k.failCount = 0
          k.checkMessage = `定时触发：已超过 ${config.autoResetDays} 天，自动恢复为活跃候选`
          recovered++
        }
      }
    }

    if (recovered > 0) {
      console.log(`[KeyPool Cron] 自动恢复了 ${recovered} 个到期的 exhausted Key`)
      await saveKeys(env.KEY_POOL_KV, keys)
    }
  },
}
