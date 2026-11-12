import { expect, test } from '@playwright/test'
import { waitForRateLimit } from './helpers'

const PROTECTED_PATHS = ['/', '/workouts', '/diet', '/progress', '/health', '/settings']

test.beforeEach(({ request }) => waitForRateLimit(request))

test('after logout, protected pages redirect to login', async ({ page }) => {
  await page.goto('/#/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/#\/login$/)

  for (const path of PROTECTED_PATHS) {
    await page.goto(`/#${path}`)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
    await expect(page).toHaveURL(/#\/login$/)
  }
})
