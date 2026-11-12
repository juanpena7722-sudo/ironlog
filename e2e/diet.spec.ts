import { expect, test } from '@playwright/test'
import { card, resetData, status } from './helpers'

test.beforeEach(({ page }) => resetData(page))

test('add foods and see the macros update', async ({ page }) => {
  await page.goto('/#/diet')
  const targets = card(page, 'Daily targets')
  await expect(targets).toContainText('2800 kcal left · 200 g protein to go')

  await page.getByLabel('Food', { exact: true }).fill('Chicken breast')
  await page.getByLabel('Calories', { exact: true }).fill('330')
  await page.getByLabel('Protein (g)').fill('62')
  await page.getByLabel('Fat (g)').fill('7')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(status(page, 'Food added.')).toBeVisible()
  await expect(targets).toContainText('2470 kcal left · 138 g protein to go')

  // Calories left empty are calculated from the macros: 5 × 4 + 80 × 4 + 1 × 9 = 349.
  await page.getByLabel('Food', { exact: true }).fill('Rice')
  await page.getByLabel('Protein (g)').fill('5')
  await page.getByLabel('Carbs (g)').fill('80')
  await page.getByLabel('Fat (g)').fill('1')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(targets).toContainText('2121 kcal left · 133 g protein to go')

  const log = card(page, 'Food log')
  await expect(log).toContainText('Chicken breast')
  await expect(log).toContainText('679 kcal · 67P / 80C / 8F')
})
