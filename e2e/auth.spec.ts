import { expect, test } from '@playwright/test'
import { PASSWORD, SIGNED_OUT, register, uniqueEmail, waitForRateLimit } from './helpers'

test.use({ storageState: SIGNED_OUT })
test.beforeEach(({ request }) => waitForRateLimit(request))

test('register, then log in and land on the dashboard', async ({ page }) => {
  const email = uniqueEmail('auth')
  await register(page, email)
  await expect(page.getByText('Welcome to IronLog')).toBeVisible()

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page).toHaveURL(/#\/$/)
})
