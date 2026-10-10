import type { Env, KeyItem, PoolConfig } from './types.js'
import {
  DEFAULT_CONFIG,
  loadConfig,
  loadKeys,
  pickCandidateKeys,
  probeKey,
  saveConfig,
  saveKeys,
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
  if (!expected) return true // 未设置密码则放行

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
  if (!expected) return true // 未设客户端 API Key 则公开

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }
  return authHeader.slice(7).trim() === expected
}

/** 解析导入文本，智能识别 key 和备注名称 */
function parseImportLines(text: string): Array<{ key: string; name: string }> {
  const lines = text.split(/\r?\n/)
  const results: Array<{ key: string; name: string }> = []

  for (let line of lines) {
    line = line.trim()
    if (!line || line.startsWith('#')) continue

    let key = ''
    let name = ''

    if (line.includes('----')) {
      const parts = line.split('----')
      if (parts[0]?.trim().startsWith('sk-')) {
        key = parts[0].trim()
        name = parts.slice(1).join('----').trim()
      } else {
        name = parts[0].trim()
        key = parts.slice(1).join('----').trim()
      }
    } else if (line.includes(',')) {
      const parts = line.split(',')
      if (parts[0]?.trim().startsWith('sk-')) {
        key = parts[0].trim()
        name = parts.slice(1).join(',').trim()
      } else {
        name = parts[0].trim()
        key = parts.slice(1).join(',').trim()
      }
    } else if (line.includes(' ')) {
      const parts = line.split(/\s+/)
      const skIndex = parts.findIndex((p) => p.startsWith('sk-'))
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

    key = key.trim().replace(/^["']|["']$/g, '')
    name = name.trim().replace(/^["']|["']$/g, '')

    if (key.length >= 8) {
      if (!name) {
        name = `Key-${key.slice(0, 4)}...${key.slice(-4)}`
      }
      results.push({ key, name })
    }
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

      // 获取状态与列表
      if (pathname === '/admin/api/status' && request.method === 'GET') {
        const keys = await loadKeys(env.KEY_POOL_KV)
        const safeConfig = { ...config, adminPassword: config.adminPassword ? '******' : '' }
        return jsonResponse({ keys, config: safeConfig })
      }

      // 导入 Keys
      if (pathname === '/admin/api/keys/import' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as { text?: string }
        if (!body.text) return jsonResponse({ error: '导入文本不能为空' }, 400)

        const parsed = parseImportLines(body.text)
        if (parsed.length === 0) return jsonResponse({ error: '未在文本中解析到有效 Key' }, 400)

        const keys = await loadKeys(env.KEY_POOL_KV)
        let importedCount = 0
        let ignoredCount = 0

        for (const item of parsed) {
          const existing = keys.find((k) => k.key.trim() === item.key.trim())
          if (existing) {
            ignoredCount++
            // 更新名称
            if (item.name && !existing.name) existing.name = item.name
          } else {
            keys.push({
              id: 'k_' + crypto.randomUUID().slice(0, 8),
              key: item.key.trim(),
              name: item.name,
              status: 'active',
              addedAt: Date.now(),
              failCount: 0,
              successCount: 0,
            })
            importedCount++
          }
        }

        await saveKeys(env.KEY_POOL_KV, keys)
        return jsonResponse({ ok: true, importedCount, ignoredCount, totalCount: keys.length })
      }

      // 测活 Keys (单张或全量)
      if (pathname === '/admin/api/keys/probe' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as { id?: string; all?: boolean }
        const keys = await loadKeys(env.KEY_POOL_KV)

        if (body.id) {
          const keyItem = keys.find((k) => k.id === body.id)
          if (!keyItem) return jsonResponse({ error: '未找到指定 Key' }, 404)

          const res = await probeKey(keyItem.key, config.targetBase, config.defaultModel)
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
          let activeCount = 0
          let exhaustedCount = 0
          let invalidCount = 0

          // 分批测活 (每批 3 个，避免并发超限)
          const batchSize = 3
          for (let i = 0; i < keys.length; i += batchSize) {
            const batch = keys.slice(i, i + batchSize)
            await Promise.all(
              batch.map(async (k) => {
                if (k.disabled) return
                const res = await probeKey(k.key, config.targetBase, config.defaultModel)
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

          await saveKeys(env.KEY_POOL_KV, keys)
          return jsonResponse({
            ok: true,
            activeCount,
            exhaustedCount,
            invalidCount,
            totalChecked: keys.filter((k) => !k.disabled).length,
          })
        }

        return jsonResponse({ error: '参数错误，必须传入 id 或 all' }, 400)
      }

      // 复活/重置状态
      if (pathname === '/admin/api/keys/revive' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as { id?: string; all?: boolean }
        const keys = await loadKeys(env.KEY_POOL_KV)
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
          for (const k of keys) {
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

      // 启用/停用 Key
      if (pathname === '/admin/api/keys/toggle' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as { id?: string }
        const keys = await loadKeys(env.KEY_POOL_KV)
        const keyItem = keys.find((k) => k.id === body.id)
        if (!keyItem) return jsonResponse({ error: '未找到指定 Key' }, 404)

        keyItem.disabled = !keyItem.disabled
        await saveKeys(env.KEY_POOL_KV, keys)
        return jsonResponse({ ok: true, disabled: keyItem.disabled })
      }

      // 删除 Key
      if (pathname === '/admin/api/keys/delete' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as { id?: string }
        let keys = await loadKeys(env.KEY_POOL_KV)
        const initialLen = keys.length
        keys = keys.filter((k) => k.id !== body.id)
        if (keys.length === initialLen) return jsonResponse({ error: '未找到指定 Key' }, 404)

        await saveKeys(env.KEY_POOL_KV, keys)
        return jsonResponse({ ok: true })
      }

      // 保存系统配置
      if (pathname === '/admin/api/config' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as Partial<PoolConfig>
        const updated: PoolConfig = {
          ...config,
          targetBase: body.targetBase ? body.targetBase.trim() : config.targetBase,
          defaultModel: body.defaultModel ? body.defaultModel.trim() : config.defaultModel,
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

    // ── 3. OpenAI 兼容网关 (/v1/*) ──
    if (pathname === '/v1/chat/completions') {
      if (!verifyClient(request, config, env)) {
        return jsonResponse(
          { error: { message: '未授权：客户端 API Key 无效或缺失', type: 'authentication_error' } },
          401
        )
      }
      return handleChatCompletions(request, env.KEY_POOL_KV, config, ctx)
    }

    if (pathname === '/v1/models') {
      if (!verifyClient(request, config, env)) {
        return jsonResponse(
          { error: { message: '未授权：客户端 API Key 无效或缺失', type: 'authentication_error' } },
          401
        )
      }
      return handleModels(request, env.KEY_POOL_KV, config)
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders() })
  },

  // ── 4. 定时 Cron：自动复活到期的 exhausted Key ──
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const config = await loadConfig(env.KEY_POOL_KV)
    const keys = await loadKeys(env.KEY_POOL_KV)
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
