import { expect, test } from '@playwright/test'

const sessionKey = 'bunzl-demo-employee-session-v1'
const usageKey = 'bunzl-demo-v1'

for (const employee of [
  { id: 'EMP001', name: 'Tejashwani Paidi' },
  { id: 'EMP002', name: 'Ashok' },
  { id: 'EMP003', name: 'Anupama' },
]) {
  test(`${employee.name} can log in, refresh, navigate, and log out`, async ({ page }) => {
    await page.route('**/api/sessions?status=completed', (route) => route.fulfill({ json: [] }))
    await page.goto('/login')
    await page.evaluate((key) => localStorage.setItem(key, 'existing usage data'), usageKey)
    await page.getByLabel('Demo profile').selectOption(employee.id)
    await page.getByRole('button', { name: 'Login' }).click()
    await expect(page.getByRole('banner').getByText(`${employee.name} · Employee`)).toBeVisible()
    expect(await page.evaluate((key) => localStorage.getItem(key), sessionKey)).toBe(employee.id)
    await page.getByRole('link', { name: 'Usage' }).click()
    await page.reload()
    await expect(page).toHaveURL(/\/usage$/)
    await expect(page.getByRole('banner').getByText(`${employee.name} · Employee`)).toBeVisible()
    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    await expect(page.getByRole('banner').getByText(`${employee.name} · Employee`)).toBeVisible()
    await expect(page.getByRole('definition').filter({ hasText: employee.name })).toBeVisible()
    await page.getByRole('button', { name: 'Logout' }).click()
    await expect(page).toHaveURL(/\/login$/)
    expect(await page.evaluate((key) => localStorage.getItem(key), sessionKey)).toBeNull()
    expect(await page.evaluate((key) => localStorage.getItem(key), usageKey)).toBe('existing usage data')
  })
}

test('requires a valid employee selection', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('Demo profile').locator('option')).toHaveText(['Select an employee', 'Tejashwani Paidi', 'Ashok', 'Anupama'])
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page.getByRole('alert')).toHaveText('Please select an employee to continue.')
  await expect(page).toHaveURL(/\/login$/)
})

test('reports storage failure instead of starting an unpersisted session', async ({ page }) => {
  await page.addInitScript((key) => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Storage blocked', 'SecurityError')
      return original.call(this, name, value)
    }
  }, sessionKey)
  await page.goto('/login')
  await page.getByLabel('Demo profile').selectOption('EMP001')
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page.getByRole('alert')).toContainText('Unable to save your demo session')
  await expect(page).toHaveURL(/\/login$/)
})

test('reports a restore failure and retains the saved employee', async ({ page }) => {
  await page.goto('/login')
  await page.evaluate((key) => localStorage.setItem(key, 'EMP002'), sessionKey)
  await page.route('**/api/demo/login', (route) => route.abort())
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Unable to restore your demo session')
  expect(await page.evaluate((key) => localStorage.getItem(key), sessionKey)).toBe('EMP002')
})

test('an invalid saved session is reported without touching usage data', async ({ page }) => {
  await page.goto('/login')
  await page.evaluate(({ session, usage }) => { localStorage.setItem(session, 'unknown'); localStorage.setItem(usage, 'existing usage data') }, { session: sessionKey, usage: usageKey })
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('saved demo session is invalid')
  expect(await page.evaluate((key) => localStorage.getItem(key), usageKey)).toBe('existing usage data')
})

test('employee selections retain the shared demo balance', async ({ page }) => {
  await page.route('**/api/sessions?status=completed', (route) => route.fulfill({ json: [] }))
  await page.goto('/login')
  await page.getByLabel('Demo profile').selectOption('EMP001')
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page.getByRole('banner').getByText('Tejashwani Paidi · Employee')).toBeVisible()
  const balance = await page.locator('.header-quota').textContent()
  await page.getByRole('button', { name: 'Logout' }).click()
  await page.getByLabel('Demo profile').selectOption('EMP003')
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page.getByRole('banner').getByText('Anupama · Employee')).toBeVisible()
  await expect(page.locator('.header-quota')).toHaveText(balance ?? '')
})

test('the longest employee name remains visible on a narrow mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.route('**/api/sessions?status=completed', (route) => route.fulfill({ json: [] }))
  await page.goto('/login')
  await page.getByLabel('Demo profile').selectOption('EMP001')
  await page.getByRole('button', { name: 'Login' }).click()
  const name = page.getByRole('banner').getByText('Tejashwani Paidi · Employee')
  await expect(name).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect.poll(() => name.evaluate((element) => element.getBoundingClientRect().right <= window.innerWidth)).toBe(true)
})
