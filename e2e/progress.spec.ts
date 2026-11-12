import { expect, test } from '@playwright/test'
import { card, isoDaysAgo, resetData, stat, status } from './helpers'

test.beforeEach(({ page }) => resetData(page))

test('add weigh-ins and see the trend chart', async ({ page }) => {
  await page.goto('/#/progress')
  const trend = card(page, 'Trend')
  await expect(trend).toContainText('Add at least two entries to see a trend.')

  await page.getByLabel('Date').fill(isoDaysAgo(1))
  await page.getByLabel(/^Weight \(kg\)/).fill('82.5')
  await page.getByRole('button', { name: 'Save check-in' }).click()
  await expect(status(page, 'Check-in saved.')).toBeVisible()

  await page.getByLabel(/^Weight \(kg\)/).fill('82')
  await page.getByRole('button', { name: 'Save check-in' }).click()

  await expect(stat(page, 'Current weight')).toContainText('82 kg')
  await expect(trend.locator('.recharts-line-curve')).toBeVisible()
  await expect(trend.locator('.recharts-line-dot')).toHaveCount(2)
  await expect(card(page, 'Check-ins').getByRole('row')).toHaveCount(3)
})
