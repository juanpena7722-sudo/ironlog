import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { AppData } from '../shared/schemas'
import { card, isoDaysAgo, resetData, stat, status } from './helpers'

test.beforeEach(({ page }) => resetData(page))

test('export then import a backup', async ({ page }) => {
  await page.goto('/#/settings')
  const yourData = card(page, 'Your data')
  await page.getByRole('button', { name: 'Load demo data' }).click()
  await page.getByRole('button', { name: 'Yes, continue' }).click()
  await expect(status(page, 'Demo data loaded.')).toBeVisible()
  const counts = yourData.getByText(/\d+ workouts · /)
  await expect(counts).not.toContainText('0 workouts')
  const before = await counts.textContent()

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^ironlog-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const path = await download.path()
  const backup = JSON.parse(await readFile(path, 'utf8')) as AppData
  expect(backup.canonicalUnit).toBe('kg')
  expect(backup.workouts.length).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Clear all logs' }).click()
  await page.getByRole('button', { name: 'Yes, continue' }).click()
  await expect(status(page, 'All logs cleared.')).toBeVisible()
  await expect(counts).toHaveText('0 workouts · 0 food entries · 0 check-ins · 0 health logs')

  await page.getByLabel('Import mode').selectOption('replace')
  await page.locator('input[type="file"]').setInputFiles(path)
  await page.getByRole('button', { name: 'Yes, continue' }).click()
  await expect(status(page, 'Data imported.')).toBeVisible()
  await expect(counts).toHaveText(before ?? '')
})

test('data saved in this browser before the account is imported', async ({ page }) => {
  // The browser-only version kept weights in the display unit, here lb.
  const local = {
    workouts: [],
    foods: [],
    body: [{ id: 'local-1', date: isoDaysAgo(0), weight: 100 }],
    health: [],
    goals: { unit: 'lb' },
  }
  await page.goto('/#/progress')
  await page.evaluate((data) => localStorage.setItem('ironlog:data', JSON.stringify(data)), local)
  await page.reload()

  const banner = page.getByRole('region', { name: 'Import data from this browser' })
  await banner.getByRole('button', { name: 'Import local data' }).click()
  await expect(status(page, 'Local data imported.')).toBeVisible()
  await expect(stat(page, 'Current weight')).toContainText('45.4 kg')
  expect(await page.evaluate(() => localStorage.getItem('ironlog:data'))).toBeNull()
})
