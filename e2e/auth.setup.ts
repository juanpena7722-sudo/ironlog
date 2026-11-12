import { test as setup } from '@playwright/test'
import { STORAGE_STATE, register, uniqueEmail } from './helpers'

setup('register the shared user', async ({ page }) => {
  await register(page, uniqueEmail('shared'))
  await page.context().storageState({ path: STORAGE_STATE })
})
