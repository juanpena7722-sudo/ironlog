import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SIGNED_OUT, resetData, status, waitForRateLimit } from './helpers'

const APP_PAGES = [
  ['/', 'Dashboard'],
  ['/workouts', 'Workouts'],
  ['/diet', 'Diet'],
  ['/progress', 'Progress'],
  ['/health', 'Health'],
  ['/settings', 'Settings'],
] as const
const AUTH_PAGES = [
  ['/login', 'Log in'],
  ['/register', 'Create account'],
] as const

test.beforeEach(({ request }) => waitForRateLimit(request))

async function expectNoSeriousViolations(page: Page, path: string, heading: string) {
  await page.goto(`/#${path}`)
  await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: /Loading/ })).toHaveCount(0)
  const { violations } = await new AxeBuilder({ page }).analyze()
  const serious = violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(serious).toEqual([])
}

test.describe('signed out', () => {
  test.use({ storageState: SIGNED_OUT })

  for (const [path, heading] of AUTH_PAGES) {
    test(`${path} has no serious or critical violations`, ({ page }) =>
      expectNoSeriousViolations(page, path, heading))
  }
})

test.describe('signed in with data', () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    const { baseURL, storageState } = testInfo.project.use
    const context = await browser.newContext({ baseURL, storageState })
    const page = await context.newPage()
    await resetData(page)
    await page.goto('/#/settings')
    await page.getByRole('button', { name: 'Load demo data' }).click()
    await page.getByRole('button', { name: 'Yes, continue' }).click()
    await expect(status(page, 'Demo data loaded.')).toBeVisible()
    await context.close()
  })

  for (const [path, heading] of APP_PAGES) {
    test(`${path} has no serious or critical violations`, ({ page }) =>
      expectNoSeriousViolations(page, path, heading))
  }
})
