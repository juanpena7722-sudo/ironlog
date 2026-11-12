import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { BodyEntry } from '../shared/schemas'
import { resetData, stat, status } from './helpers'

test.beforeEach(({ page }) => resetData(page))

async function switchUnit(page: Page, unit: 'kg' | 'lb') {
  await page.goto('/#/settings')
  await page.getByLabel('Units').selectOption(unit)
  await page.getByRole('button', { name: 'Save targets' }).click()
  await expect(status(page, 'Targets saved.')).toBeVisible()
}

test('switch kg ↔ lb and see converted values', async ({ page }) => {
  await switchUnit(page, 'lb')
  await expect(page.getByLabel('Target weight (lb)')).toHaveValue('187.4')

  await page.getByRole('link', { name: 'Progress' }).click()
  await page.getByLabel(/^Weight \(lb\)/).fill('100')
  await page.getByRole('button', { name: 'Save check-in' }).click()
  await expect(stat(page, 'Current weight')).toContainText('100 lb')

  const body = (await (await page.request.get('/api/v1/body')).json()) as BodyEntry[]
  expect(body.map((b) => b.weight)).toEqual([45.36])

  await switchUnit(page, 'kg')
  await expect(page.getByLabel('Target weight (kg)')).toHaveValue('85')
  await page.getByRole('link', { name: 'Progress' }).click()
  await expect(stat(page, 'Current weight')).toContainText('45.4 kg')
})
