import { expect, test } from '@playwright/test'
import { card, resetData, status } from './helpers'

test.beforeEach(({ page }) => resetData(page))

test('log a workout and see the personal record', async ({ page }) => {
  await page.goto('/#/workouts')
  await expect(card(page, 'Personal records (est. 1RM)')).toContainText(
    'Log a workout to see your PRs.',
  )

  await page.getByRole('button', { name: '+ Log workout' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Push day')
  await page.getByLabel('Exercise 1 name').fill('Bench Press')
  await page.getByLabel('Set 1 weight (kg)').fill('100')
  await page.getByLabel('Set 1 reps').fill('5')
  await page.getByRole('button', { name: 'Save workout' }).click()
  await expect(status(page, 'Workout saved.')).toBeVisible()

  const record = card(page, 'Personal records (est. 1RM)').getByRole('row', {
    name: /Bench Press/,
  })
  await expect(record).toContainText('100 × 5')
  await expect(record).toContainText('116.7 kg')
  await expect(card(page, 'History')).toContainText('Push day')
})
