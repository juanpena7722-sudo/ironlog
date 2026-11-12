import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  // Every test shares one user and resets its data, so tests run one at a time.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: 'auth.setup.ts' },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], storageState: 'test-results/.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        storageState: 'test-results/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
})
