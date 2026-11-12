import { expect, test } from '@playwright/test'
import { card, resetData, stat, status } from './helpers'

test.beforeEach(({ page }) => resetData(page))

test('add a health entry', async ({ page }) => {
  await page.goto('/#/health')
  await expect(card(page, 'History')).toContainText('No health logs yet.')

  await page.getByLabel('Sleep (h)').fill('7.5')
  await page.getByLabel('Water (L)').fill('3')
  await page.getByLabel('Resting HR (bpm)').fill('55')
  await page.getByLabel('Steps').fill('9000')
  await page.getByLabel('Energy').selectOption({ label: '🙂 Good' })
  await page.getByLabel('Notes').fill('Felt fresh')
  await page.getByRole('button', { name: 'Save day' }).click()
  await expect(status(page, 'Day saved.')).toBeVisible()

  await expect(page.getByRole('button', { name: 'Update day' })).toBeVisible()
  await expect(stat(page, 'Avg sleep (7d)')).toContainText('7.5 h')
  const row = card(page, 'History').getByRole('row').nth(1)
  for (const text of ['7.5 h', '3 L', '55', '9,000', '🙂 Good', 'Felt fresh']) {
    await expect(row).toContainText(text)
  }
})
