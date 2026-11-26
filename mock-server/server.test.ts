import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createMockServer } from './server.ts'
import type { AddressInfo } from 'node:net'

const server = createMockServer()
let base: string

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
})
after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

async function call(path: string, method = 'GET', token?: string, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: response.status, data: await response.json() }
}

test('mock API enforces demo identity, module permissions and session quota', async () => {
  assert.equal((await call('/quota')).status, 401)
  const employee = await call('/demo/login', 'POST', undefined, { userId: 'employee' })
  const token = employee.data.token
  const limited = await call('/demo/login', 'POST', undefined, { userId: 'limited' })
  const restrictedModules = await call('/modules', 'GET', limited.data.token)
  assert.equal(restrictedModules.data.some((module: { moduleName: string }) => module.moduleName === 'matchpoint'), false)
  assert.equal((await call('/sessions/start', 'POST', limited.data.token, { moduleName: 'matchpoint' })).status, 403)
  assert.equal((await call('/quota', 'GET', token)).data.remaining, 755_000)
  const spark = await call('/sessions/start', 'POST', token, { moduleName: 'spark' })
  const scout = await call('/sessions/start', 'POST', token, { moduleName: 'scout' })
  const invoke = await call('/gateway/spark/invoke', 'POST', token, { prompt: 'Test request', sessionId: spark.data.sessionId })
  assert.equal(invoke.data.usage.totalTokens, 2_500)
  assert.equal((await call('/quota', 'GET', token)).data.remaining, 752_500)
  const end = await call(`/sessions/${spark.data.sessionId}/end`, 'POST', token)
  assert.equal(end.data.tokensUsed, 2_500)
  assert.equal((await call(`/sessions/${spark.data.sessionId}/end`, 'POST', token)).data.tokensUsed, 2_500)
  assert.equal((await call(`/sessions/${scout.data.sessionId}/summary`, 'GET', token)).data.status, 'active')
  assert.equal((await call('/usage/history?module=spark', 'GET', token)).data.total, 1)
  assert.equal((await call('/settings', 'PUT', token, { quotaAlerts: false, usageDigest: true })).data.quotaAlerts, false)
  assert.equal((await call('/settings', 'GET', token)).data.quotaAlerts, false)
  assert.equal((await call('/admin/users', 'GET', token)).status, 403)
  const admin = await call('/demo/login', 'POST', undefined, { userId: 'admin' })
  assert.equal((await call('/admin/permissions', 'PUT', admin.data.token, { userId: 'limited', moduleName: 'matchpoint', enabled: true })).status, 200)
  assert.equal((await call('/sessions/start', 'POST', limited.data.token, { moduleName: 'matchpoint' })).status, 201)
  assert.equal((await call('/admin/quotas', 'PUT', admin.data.token, { userId: 'employee', moduleName: 'scout', monthlyLimit: 25_000 })).status, 200)
  assert.equal((await call('/gateway/scout/invoke', 'POST', token, { prompt: 'Over quota', sessionId: scout.data.sessionId })).data.code, 'QUOTA_EXCEEDED')
  assert.equal((await call('/quota', 'GET', token)).data.remaining, 752_500)
})
