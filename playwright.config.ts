import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4174', headless: true },
  webServer: [
    { command: 'npm run dev:mock', url: 'http://127.0.0.1:3002/api/quota', env: { MOCK_API_PORT: '3002' }, reuseExistingServer: false },
    { command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort', url: 'http://127.0.0.1:4174', env: { MOCK_API_TARGET: 'http://127.0.0.1:3002' }, reuseExistingServer: false },
  ],
})
