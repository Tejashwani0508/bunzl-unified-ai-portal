import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'

type ModuleName = 'spark' | 'asknexa' | 'matchpoint' | 'scout'
type UserId = 'employee' | 'limited' | 'admin'
type SessionStatus = 'active' | 'completed' | 'expired'
type Session = { sessionId: string; userId: UserId; moduleName: ModuleName; status: SessionStatus; startedAt: string; lastHeartbeat: number; endedAt?: string; tokensUsed: number; remainingQuota?: number }
type UsageRow = { requestId: string; userId: UserId; moduleName: ModuleName; sessionId: string; timestamp: string; totalTokens: number; promptTokens: number; completionTokens: number; model: string; estimatedCostUsd: null; status: string }

const modules = [
  { moduleName: 'spark', displayName: 'Spark', description: 'Specification, planning and requirement knowledge.', isEnabled: true, features: ['request'] },
  { moduleName: 'asknexa', displayName: 'AskNexa', description: 'Enterprise knowledge search and insights.', isEnabled: true, features: ['request'] },
  { moduleName: 'matchpoint', displayName: 'MatchPoint', description: 'AI-powered matching and recommendations.', isEnabled: true, features: ['request'] },
  { moduleName: 'scout', displayName: 'Scout', description: 'Intelligent product and information search.', isEnabled: true, features: ['request'] },
] as const
const users = {
  employee: { id: 'employee', displayName: 'John Doe', email: 'john.doe@example.com', roles: ['employee'] },
  limited: { id: 'limited', displayName: 'Demo Limited User', email: 'limited@example.com', roles: ['employee'] },
  admin: { id: 'admin', displayName: 'Demo Administrator', email: 'admin@example.com', roles: ['employee', 'admin'] },
}
const baseline: Record<ModuleName, number> = { spark: 100_000, asknexa: 80_000, matchpoint: 40_000, scout: 25_000 }
const initialLimit = 1_000_000
const cost = 2_500
const expiryMs = 120_000

function isModule(value: unknown): value is ModuleName {
  return typeof value === 'string' && modules.some((module) => module.moduleName === value)
}

function isUser(value: unknown): value is UserId {
  return value === 'employee' || value === 'limited' || value === 'admin'
}

async function bodyOf(req: IncomingMessage): Promise<Record<string, unknown>> {
  let content = ''
  for await (const chunk of req) {
    content += String(chunk)
    if (content.length > 32_000) throw new Error('Request body is too large.')
  }
  const parsed: unknown = content ? JSON.parse(content) : {}
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected a JSON object.')
  return parsed as Record<string, unknown>
}

export function createMockServer() {
  const tokens = new Map<string, UserId>()
  const sessions = new Map<string, Session>()
  const ledger: UsageRow[] = []
  const preferences = new Map<UserId, { quotaAlerts: boolean; usageDigest: boolean }>()
  const permissions = new Map<UserId, Set<ModuleName>>(
    (Object.keys(users) as UserId[]).map((id) => [id, new Set(modules.map((module) => module.moduleName).filter((name) => id !== 'limited' || name !== 'matchpoint'))]),
  )
  const limits = new Map<UserId, number>()
  const moduleLimits = new Map<string, number>()

  function used(id: UserId) {
    return Object.values(baseline).reduce((a, b) => a + b, 0) + ledger.filter((row) => row.userId === id).reduce((sum, row) => sum + row.totalTokens, 0)
  }
  function quota(id: UserId) {
    const now = new Date()
    const limit = limits.get(id) ?? initialLimit
    const consumed = used(id)
    return { limit, used: consumed, reserved: 0, remaining: Math.max(0, limit - consumed), resetDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(), scope: 'user', asOf: now.toISOString() }
  }
  function moduleUsed(id: UserId, name: ModuleName) {
    return baseline[name] + ledger.filter((row) => row.userId === id && row.moduleName === name).reduce((sum, row) => sum + row.totalTokens, 0)
  }
  function expire() {
    for (const session of sessions.values()) {
      if (session.status === 'active' && Date.now() - session.lastHeartbeat >= expiryMs) {
        session.status = 'expired'
        session.endedAt = new Date().toISOString()
        session.remainingQuota = quota(session.userId).remaining
      }
    }
  }
  function respond(res: ServerResponse, status: number, data: unknown, requestId: string) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Request-Id': requestId })
    res.end(JSON.stringify(data))
  }

  const server = createServer(async (req, res) => {
    const requestId = randomUUID()
    const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) => respond(res, status, { code, message, requestId, ...extra }, requestId)
    const origin = req.headers.origin
    if (origin && /^http:\/\/(localhost|127\.0\.0\.1):(5173|4173|4174)$/.test(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Request-Id')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
      res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id, X-Tokens-Used, X-Quota-Remaining')
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname
    try {
      if (req.method === 'POST' && path === '/api/demo/login') {
        const body = await bodyOf(req)
        if (!isUser(body.userId)) return fail(400, 'INVALID_USER', 'Select a demo user.')
        const token = randomUUID()
        tokens.set(token, body.userId)
        return respond(res, 200, { token, user: users[body.userId] }, requestId)
      }
      const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
      const userId = bearer ? tokens.get(bearer) : undefined
      if (!userId) return fail(401, 'UNAUTHENTICATED', 'Demo sign-in required.')
      expire()
      if (req.method === 'GET' && path === '/api/auth/me') return respond(res, 200, users[userId], requestId)
      if (req.method === 'GET' && path === '/api/modules') return respond(res, 200, modules.filter((module) => permissions.get(userId)?.has(module.moduleName)).map((module) => {
        const limit = moduleLimits.get(`${userId}:${module.moduleName}`)
        const consumed = moduleUsed(userId, module.moduleName)
        return { ...module, ...(limit === undefined ? {} : { quota: { limit, used: consumed, reserved: 0, remaining: Math.max(0, limit - consumed), resetDate: quota(userId).resetDate, scope: 'module', asOf: new Date().toISOString() } }) }
      }), requestId)
      if (req.method === 'GET' && (path === '/api/quota' || path === '/api/gateway/usage/current')) return respond(res, 200, quota(userId), requestId)
      if (req.method === 'GET' && path === '/api/settings') return respond(res, 200, preferences.get(userId) ?? { quotaAlerts: true, usageDigest: true }, requestId)
      if (req.method === 'PUT' && path === '/api/settings') {
        const body = await bodyOf(req)
        if (typeof body.quotaAlerts !== 'boolean' || typeof body.usageDigest !== 'boolean') return fail(400, 'INVALID_SETTINGS', 'Both settings must be boolean.')
        const settings = { quotaAlerts: body.quotaAlerts, usageDigest: body.usageDigest }
        preferences.set(userId, settings)
        return respond(res, 200, settings, requestId)
      }
      if (req.method === 'GET' && path === '/api/usage/modules') {
        return respond(res, 200, modules.map((module) => ({ moduleName: module.moduleName, totalTokens: moduleUsed(userId, module.moduleName) })), requestId)
      }
      if (req.method === 'GET' && path === '/api/usage/summary') return respond(res, 200, quota(userId), requestId)
      if (req.method === 'GET' && path === '/api/usage/history') {
        const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? '10', 10) || 10))
        const module = url.searchParams.get('module')
        const from = url.searchParams.get('from')
        const to = url.searchParams.get('to')
        const rows = ledger.filter((row) => row.userId === userId && (!module || row.moduleName === module) && (!from || row.timestamp >= from) && (!to || row.timestamp <= to)).reverse()
        return respond(res, 200, { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize }, requestId)
      }
      if (req.method === 'POST' && path === '/api/sessions/start') {
        const body = await bodyOf(req)
        if (!isModule(body.moduleName)) return fail(400, 'INVALID_MODULE', 'Unknown module.')
        if (!permissions.get(userId)?.has(body.moduleName)) return fail(403, 'FORBIDDEN', 'Module access denied.')
        const session: Session = { sessionId: randomUUID(), userId, moduleName: body.moduleName, status: 'active', startedAt: new Date().toISOString(), lastHeartbeat: Date.now(), tokensUsed: 0 }
        sessions.set(session.sessionId, session)
        const frontendOrigin = origin && /^http:\/\/(localhost|127\.0\.0\.1):(5173|4173|4174)$/.test(origin) ? origin : 'http://127.0.0.1:5173'
        return respond(res, 201, { ...session, launchUrl: `${frontendOrigin}/demo/${session.moduleName}?sessionId=${session.sessionId}&fixture=${userId}` }, requestId)
      }
      if (req.method === 'GET' && path === '/api/sessions') {
        const status = url.searchParams.get('status')
        return respond(res, 200, [...sessions.values()].filter((session) => session.userId === userId && (!status || (status === 'completed' ? session.status !== 'active' : session.status === status))), requestId)
      }
      const sessionMatch = path.match(/^\/api\/sessions\/([^/]+)\/(heartbeat|end|summary)$/)
      if (sessionMatch) {
        const session = sessions.get(sessionMatch[1])
        if (!session || session.userId !== userId) return fail(404, 'NOT_FOUND', 'Session not found.')
        if (sessionMatch[2] === 'summary' && req.method === 'GET') return respond(res, 200, session, requestId)
        if (sessionMatch[2] === 'heartbeat' && req.method === 'POST') {
          if (session.status !== 'active') return fail(409, 'SESSION_ENDED', 'Session is no longer active.')
          session.lastHeartbeat = Date.now()
          return respond(res, 200, session, requestId)
        }
        if (sessionMatch[2] === 'end' && req.method === 'POST') {
          if (session.status === 'active') {
            session.status = 'completed'
            session.endedAt = new Date().toISOString()
            session.remainingQuota = quota(userId).remaining
          }
          return respond(res, 200, session, requestId)
        }
      }
      const invokeMatch = path.match(/^\/api\/gateway\/([^/]+)\/invoke$/)
      if (req.method === 'POST' && invokeMatch) {
        const name = invokeMatch[1]
        if (!isModule(name)) return fail(404, 'NOT_FOUND', 'Unknown module.')
        if (!permissions.get(userId)?.has(name)) return fail(403, 'FORBIDDEN', 'Module access denied.')
        const body = await bodyOf(req)
        if (typeof body.prompt !== 'string' || !body.prompt.trim() || typeof body.sessionId !== 'string') return fail(400, 'INVALID_REQUEST', 'A prompt and session ID are required.')
        const session = sessions.get(body.sessionId)
        if (!session || session.userId !== userId || session.moduleName !== name || session.status !== 'active') return fail(409, 'INVALID_SESSION', 'An active session is required.')
        const current = quota(userId)
        if (current.remaining < cost) return fail(429, 'QUOTA_EXCEEDED', 'Insufficient quota. Contact an administrator.', { remaining: current.remaining, resetDate: current.resetDate })
        const moduleLimit = moduleLimits.get(`${userId}:${name}`)
        if (moduleLimit !== undefined && moduleLimit - moduleUsed(userId, name) < cost) return fail(429, 'QUOTA_EXCEEDED', 'Insufficient module quota. Contact an administrator.', { remaining: Math.max(0, moduleLimit - moduleUsed(userId, name)), resetDate: current.resetDate })
        const row: UsageRow = { requestId, userId, moduleName: name, sessionId: session.sessionId, timestamp: new Date().toISOString(), totalTokens: cost, promptTokens: 1_000, completionTokens: 1_500, model: 'demo', estimatedCostUsd: null, status: 'completed' }
        ledger.push(row)
        session.tokensUsed += cost
        res.setHeader('X-Tokens-Used', String(cost))
        res.setHeader('X-Quota-Remaining', String(quota(userId).remaining))
        return respond(res, 200, { content: `Simulated ${name} response. No AI provider was contacted.`, model: row.model, usage: { promptTokens: row.promptTokens, completionTokens: row.completionTokens, totalTokens: cost }, requestId }, requestId)
      }
      if (path.startsWith('/api/admin/')) {
        if (!users[userId].roles.includes('admin')) return fail(403, 'FORBIDDEN', 'Administrator access required.')
        if (req.method === 'GET' && path === '/api/admin/users') {
          const search = (url.searchParams.get('search') ?? '').toLowerCase()
          const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
          const pageSize = 10
          const matched = (Object.keys(users) as UserId[]).filter((id) => `${users[id].displayName} ${users[id].email}`.toLowerCase().includes(search))
          return respond(res, 200, { items: matched.slice((page - 1) * pageSize, page * pageSize).map((id) => ({ ...users[id], permissions: [...(permissions.get(id) ?? [])] })), page, pageSize, total: matched.length }, requestId)
        }
        if (req.method === 'PUT' && path === '/api/admin/permissions') {
          const body = await bodyOf(req)
          if (!isUser(body.userId) || !isModule(body.moduleName) || typeof body.enabled !== 'boolean') return fail(400, 'INVALID_REQUEST', 'A valid user, module and enabled flag are required.')
          const assigned = permissions.get(body.userId)!
          if (body.enabled) assigned.add(body.moduleName)
          else assigned.delete(body.moduleName)
          return respond(res, 200, { userId: body.userId, moduleName: body.moduleName, enabled: body.enabled }, requestId)
        }
        if (req.method === 'PUT' && path === '/api/admin/quotas') {
          const body = await bodyOf(req)
          if (!isUser(body.userId) || !isModule(body.moduleName) || typeof body.monthlyLimit !== 'number' || !Number.isSafeInteger(body.monthlyLimit) || body.monthlyLimit < 0) return fail(400, 'INVALID_REQUEST', 'A valid user, module and non-negative monthly limit are required.')
          moduleLimits.set(`${body.userId}:${body.moduleName}`, body.monthlyLimit)
          return respond(res, 200, { userId: body.userId, moduleName: body.moduleName, monthlyLimit: body.monthlyLimit }, requestId)
        }
        if (req.method === 'GET' && path === '/api/admin/reports') {
          const module = url.searchParams.get('module')
          const from = url.searchParams.get('from')
          const to = url.searchParams.get('to')
          return respond(res, 200, ledger.filter((row) => (!module || row.moduleName === module) && (!from || row.timestamp >= from) && (!to || row.timestamp <= to)), requestId)
        }
      }
      return fail(404, 'NOT_FOUND', 'Endpoint not found.')
    } catch (error) {
      if (error instanceof SyntaxError || (error instanceof Error && (error.message === 'Request body is too large.' || error.message === 'Expected a JSON object.'))) return fail(400, 'INVALID_REQUEST', 'Invalid JSON request.')
      console.error('Mock API error:', error)
      return fail(500, 'INTERNAL_ERROR', 'Mock server error.')
    }
  })
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createMockServer()
  const port = Number(process.env.MOCK_API_PORT ?? '3001')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MOCK_API_PORT must be a valid port.')
  server.listen(port, '127.0.0.1', () => console.log(`Demo-only mock API listening on http://127.0.0.1:${port}`))
}
