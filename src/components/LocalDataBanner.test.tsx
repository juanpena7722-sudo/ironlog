import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { DEFAULT_GOALS } from '../store'
import { GOALS, USER } from '../test/handlers'
import { renderApp } from '../test/render'
import { server } from '../test/setup'

const LOCAL_DATA_KEY = 'ironlog:data'
const DISMISSED_KEY = 'ironlog:local-import-dismissed'
const BANNER = 'Import data from this browser'

// Shape written by the browser-only version: weights in the display unit, no health key.
const LOCAL_DATA = {
  version: 1,
  workouts: [],
  foods: [],
  body: [{ id: 'b1', date: '2025-01-02', weight: 200 }],
  goals: { unit: 'lb', calories: 2500 },
}

function storeLocalData(data: unknown = LOCAL_DATA) {
  localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(data))
}

function mockImport(response: () => Response) {
  const imports: { search: string; body: unknown }[] = []
  server.use(
    http.post('/api/v1/backup/import', async ({ request }) => {
      imports.push({ search: new URL(request.url).search, body: await request.json() })
      return response()
    }),
  )
  return imports
}

async function renderDashboard() {
  renderApp('/')
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
}

describe('local data banner', () => {
  it.each([
    ['there is no local data', () => {}],
    ['the local data has no entries', () => storeLocalData({ version: 1, goals: GOALS })],
    ['the local data is not JSON', () => localStorage.setItem(LOCAL_DATA_KEY, '{')],
    [
      'it was dismissed',
      () => {
        storeLocalData()
        localStorage.setItem(DISMISSED_KEY, 'true')
      },
    ],
  ])('is hidden when %s', async (_, setup) => {
    setup()
    await renderDashboard()

    expect(screen.queryByRole('region', { name: BANNER })).toBeNull()
  })

  it('shows only when there is local data', async () => {
    storeLocalData()
    await renderDashboard()

    expect(screen.getByRole('region', { name: BANNER })).toBeDefined()
  })

  it('merges the local data in its stored unit, then clears it and refreshes', async () => {
    let goalsRequests = 0
    let sessionRequests = 0
    server.use(
      http.get('/api/v1/goals', () => {
        goalsRequests += 1
        return HttpResponse.json(GOALS)
      }),
      http.get('/api/v1/auth/me', () => {
        sessionRequests += 1
        return HttpResponse.json(USER)
      }),
    )
    const imports = mockImport(() => HttpResponse.json({ imported: {}, skipped: {} }))
    storeLocalData()
    await renderDashboard()
    await waitFor(() => expect(goalsRequests).toBe(1))

    await userEvent.setup().click(screen.getByRole('button', { name: 'Import local data' }))

    await waitFor(() => expect(screen.queryByRole('region', { name: BANNER })).toBeNull())
    expect(screen.getByText('Local data imported.').getAttribute('role')).toBe('status')
    expect(imports).toEqual([
      {
        search: '?mode=merge&unitHint=lb',
        body: {
          version: 1,
          workouts: [],
          foods: [],
          body: LOCAL_DATA.body,
          health: [],
          goals: { ...DEFAULT_GOALS, unit: 'lb', calories: 2500 },
        },
      },
    ])
    expect(localStorage.getItem(LOCAL_DATA_KEY)).toBeNull()
    await waitFor(() => expect(goalsRequests).toBe(2))
    expect(sessionRequests).toBe(1)
  })

  it('keeps the local data and shows the error when the import fails', async () => {
    mockImport(() =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Bad Request', status: 400, detail: 'Invalid backup file' },
        { status: 400 },
      ),
    )
    storeLocalData()
    await renderDashboard()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Import local data' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Invalid backup file')
    expect(screen.getByRole('region', { name: BANNER })).toBeDefined()
    expect(localStorage.getItem(LOCAL_DATA_KEY)).toBe(JSON.stringify(LOCAL_DATA))
  })

  it('remembers a dismissal and keeps the local data', async () => {
    storeLocalData()
    await renderDashboard()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByRole('region', { name: BANNER })).toBeNull()
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('true')
    expect(localStorage.getItem(LOCAL_DATA_KEY)).toBe(JSON.stringify(LOCAL_DATA))
  })
})
