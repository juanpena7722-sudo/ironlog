import { expect, test } from '@playwright/test'
import type { APIRequestContext, Locator, Page } from '@playwright/test'
import type { AppData, Goals } from '../shared/schemas'

export const STORAGE_STATE = 'test-results/.auth/user.json'
export const SIGNED_OUT = { cookies: [], origins: [] }
export const PASSWORD = 'e2e-password-123'

export const uniqueEmail = (label: string) =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`

export function isoDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export async function register(page: Page, email: string) {
  await page.goto('/#/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

const DEFAULT_GOALS: Goals = {
  unit: 'kg',
  calories: 2800,
  protein: 200,
  carbs: 320,
  fat: 80,
  targetWeight: 85,
  waterL: 4,
  sleepHours: 8,
}
// More than any single test sends, including the page loads it triggers.
const REQUESTS_PER_TEST = 60

// All e2e traffic comes from one IP, so a test that could exhaust the API's per-minute limit
// first waits for the next window instead of failing with 429.
export async function waitForRateLimit(request: APIRequestContext) {
  const headers = (await request.get('/api/v1/health')).headers()
  if (Number(headers['x-ratelimit-remaining']) >= REQUESTS_PER_TEST) return
  const waitMs = (Number(headers['x-ratelimit-reset']) + 1) * 1000
  test.info().setTimeout(test.info().timeout + waitMs)
  await new Promise((resolve) => setTimeout(resolve, waitMs))
}

// Gives the shared user no logs and the default targets, so each test starts from the same state.
export async function resetData(page: Page) {
  await waitForRateLimit(page.request)
  const data: AppData = {
    version: 1,
    workouts: [],
    foods: [],
    body: [],
    health: [],
    goals: DEFAULT_GOALS,
  }
  const response = await page.request.post('/api/v1/backup/import?mode=replace', { data })
  expect(response.ok()).toBe(true)
}

export const card = (page: Page, title: string): Locator =>
  page.locator('section.card').filter({ has: page.getByRole('heading', { name: title }) })

export const stat = (page: Page, label: string): Locator =>
  page.locator('.stat').filter({ has: page.getByText(label, { exact: true }) })

export const status = (page: Page, text: string): Locator =>
  page.getByRole('status').filter({ hasText: text })
