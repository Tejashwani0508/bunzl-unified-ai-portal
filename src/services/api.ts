export interface User {
  id: string
  email: string
  displayName: string
  roles: string[]
}

export interface Quota {
  limit: number
  used: number
  reserved: number
  remaining: number
  resetDate: string
  asOf: string
  scope: 'user' | 'module'
}

export interface Module {
  moduleName: string
  displayName: string
  description: string
  iconUrl?: string
  isEnabled: boolean
  features: string[]
  quota?: Quota
}

export interface Session {
  sessionId: string
  moduleName: string
  status: 'active' | 'ending' | 'completed' | 'expired' | 'pending'
  startedAt: string
  endedAt?: string
  tokensUsed?: number
  remainingQuota?: number
  launchUrl?: string
}

export interface UsageRow {
  requestId: string
  moduleName: string
  timestamp: string
  totalTokens: number
  status: string
  estimatedCostUsd: number | null
}

export interface Settings {
  quotaAlerts: boolean
  usageDigest: boolean
}

export interface AdminUser extends User {
  permissions: string[]
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId?: string

  constructor(message: string, status: number, code: string, requestId?: string) {
    super(message)
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

const baseUrl = import.meta.env.VITE_API_BASE_URL
export const demoMode = import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'demo'

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The server returned an invalid response.')
  return value as Record<string, unknown>
}
function string(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('The server returned an invalid response.')
  return value
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('The server returned an invalid response.')
  return value
}
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('The server returned an invalid response.')
  return value
}
function date(value: unknown): string {
  const result = string(value)
  if (Number.isNaN(Date.parse(result))) throw new Error('The server returned an invalid date.')
  return result
}
function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error('The server returned an invalid response.')
  return value.map(parse)
}

function parseUser(value: unknown): User {
  const v = object(value)
  return { id: string(v.id), displayName: string(v.displayName), email: string(v.email), roles: array(v.roles, string) }
}
function parseQuota(value: unknown): Quota {
  const v = object(value)
  if (v.scope !== 'user' && v.scope !== 'module') throw new Error('The server returned an invalid quota scope.')
  return { limit: number(v.limit), used: number(v.used), reserved: number(v.reserved), remaining: number(v.remaining), resetDate: date(v.resetDate), asOf: date(v.asOf), scope: v.scope }
}
function parseModule(value: unknown): Module {
  const v = object(value)
  return { moduleName: string(v.moduleName), displayName: string(v.displayName), description: string(v.description), isEnabled: bool(v.isEnabled), features: array(v.features, string), ...(v.iconUrl == null ? {} : { iconUrl: string(v.iconUrl) }), ...(v.quota == null ? {} : { quota: parseQuota(v.quota) }) }
}
function parseSession(value: unknown): Session {
  const v = object(value)
  if (v.status !== 'active' && v.status !== 'ending' && v.status !== 'completed' && v.status !== 'expired' && v.status !== 'pending') throw new Error('The server returned an invalid session status.')
  return { sessionId: string(v.sessionId), moduleName: string(v.moduleName), status: v.status, startedAt: date(v.startedAt), ...(v.endedAt == null ? {} : { endedAt: date(v.endedAt) }), ...(v.tokensUsed == null ? {} : { tokensUsed: number(v.tokensUsed) }), ...(v.remainingQuota == null ? {} : { remainingQuota: number(v.remainingQuota) }), ...(v.launchUrl == null ? {} : { launchUrl: string(v.launchUrl) }) }
}
function parseUsage(value: unknown): UsageRow {
  const v = object(value)
  return { requestId: string(v.requestId), moduleName: string(v.moduleName), timestamp: date(v.timestamp), totalTokens: number(v.totalTokens), status: string(v.status), estimatedCostUsd: v.estimatedCostUsd == null ? null : number(v.estimatedCostUsd) }
}
function parseSettings(value: unknown): Settings {
  const v = object(value)
  return { quotaAlerts: bool(v.quotaAlerts), usageDigest: bool(v.usageDigest) }
}

async function request<T>(path: string, parse: (value: unknown) => T, options: { token?: string; method?: 'GET' | 'POST' | 'PUT'; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  if (!baseUrl || !baseUrl.endsWith('/api')) throw new Error('API configuration is missing or invalid.')
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: { 'X-Request-Id': crypto.randomUUID(), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}), ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  })
  const payload: unknown = await response.json()
  if (!response.ok) {
    const error = object(payload)
    throw new ApiError(typeof error.message === 'string' ? error.message : 'The request failed.', response.status, typeof error.code === 'string' ? error.code : 'UNKNOWN', typeof error.requestId === 'string' ? error.requestId : undefined)
  }
  return parse(payload)
}

export const api = {
  login: (fixture: string) => request('/demo/login', (value) => { const v = object(value); return { token: string(v.token), user: parseUser(v.user) } }, { method: 'POST', body: { userId: fixture } }),
  modules: (token: string, signal?: AbortSignal) => request('/modules', (value) => array(value, parseModule), { token, signal }),
  quota: (token: string, signal?: AbortSignal) => request('/quota', parseQuota, { token, signal }),
  breakdown: (token: string, signal?: AbortSignal) => request('/usage/modules', (value) => array(value, (item) => { const v = object(item); return { moduleName: string(v.moduleName), totalTokens: number(v.totalTokens) } }), { token, signal }),
  history: (token: string, params: URLSearchParams, signal?: AbortSignal) => request(`/usage/history?${params}`, (value) => { const v = object(value); return { items: array(v.items, parseUsage), total: number(v.total), page: number(v.page), pageSize: number(v.pageSize) } }, { token, signal }),
  start: (token: string, moduleName: string) => request('/sessions/start', parseSession, { token, method: 'POST', body: { moduleName } }),
  sessions: (token: string, signal?: AbortSignal) => request('/sessions?status=completed', (value) => array(value, parseSession), { token, signal }),
  heartbeat: (token: string, id: string) => request(`/sessions/${encodeURIComponent(id)}/heartbeat`, parseSession, { token, method: 'POST' }),
  end: (token: string, id: string) => request(`/sessions/${encodeURIComponent(id)}/end`, parseSession, { token, method: 'POST' }),
  settings: (token: string, signal?: AbortSignal) => request('/settings', parseSettings, { token, signal }),
  saveSettings: (token: string, settings: Settings) => request('/settings', parseSettings, { token, method: 'PUT', body: settings }),
  invoke: (token: string, moduleName: string, sessionId: string, prompt: string) => request(`/gateway/${encodeURIComponent(moduleName)}/invoke`, (value) => { const v = object(value); return { content: string(v.content) } }, { token, method: 'POST', body: { sessionId, prompt, feature: 'request' } }),
  adminUsers: (token: string, search: string, page: number, signal?: AbortSignal) => request(`/admin/users?${new URLSearchParams({ search, page: String(page) })}`, (value) => { const v = object(value); return { items: array(v.items, (item) => { const data = object(item); return { ...parseUser(item), permissions: array(data.permissions, string) } }), total: number(v.total), pageSize: number(v.pageSize) } }, { token, signal }),
  adminPermission: (token: string, userId: string, moduleName: string, enabled: boolean) => request('/admin/permissions', object, { token, method: 'PUT', body: { userId, moduleName, enabled } }),
  adminQuota: (token: string, userId: string, moduleName: string, monthlyLimit: number) => request('/admin/quotas', object, { token, method: 'PUT', body: { userId, moduleName, monthlyLimit } }),
  adminReports: (token: string, params: URLSearchParams, signal?: AbortSignal) => request(`/admin/reports?${params}`, (value) => array(value, parseUsage), { token, signal }),
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return `${error.message}${error.requestId ? ` (Reference: ${error.requestId})` : ''}`
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}
