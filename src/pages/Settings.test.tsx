import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SESSION_KEY } from '../api/auth'
import type { AppData, BodyEntry } from '../types'
import { GOALS } from '../test/handlers'
import { mockCollection, mockGoals } from '../test/mockApi'
import { renderApp, renderWithProviders } from '../test/render'
import { server } from '../test/setup'
import Settings from './Settings'

const CHECK_IN: BodyEntry = {
  id: '4e2d9c1b-7a6f-4b3e-9d2c-1a0b9c8d7e6f',
  date: '2026-03-02',
  weight: 90,
}

describe('targets', () => {
  it('shows the saved goals and saves edits', async () => {
    const saved = mockGoals(GOALS)
    renderWithProviders(<Settings />)
    const user = userEvent.setup()

    const calories = await screen.findByLabelText('Calories (kcal)')
    await waitFor(() => expect(calories).toHaveProperty('value', '2500'))
    await user.clear(calories)
    await user.type(calories, '3000')
    await user.click(screen.getByRole('button', { name: 'Save targets' }))

    expect(await screen.findByText('Targets saved.')).toBeDefined()
    expect(saved).toEqual([{ ...GOALS, calories: 3000 }])
  })

  it('shows the target weight in lb and saves it in kg', async () => {
    const saved = mockGoals({ ...GOALS, unit: 'lb' })
    renderWithProviders(<Settings />)
    const user = userEvent.setup()

    const target = await screen.findByLabelText('Target weight (lb)')
    await waitFor(() => expect(target).toHaveProperty('value', '176.4'))
    await user.clear(target)
    await user.type(target, '200')
    await user.click(screen.getByRole('button', { name: 'Save targets' }))

    await screen.findByText('Targets saved.')
    expect(saved[0]).toMatchObject({ unit: 'lb', targetWeight: 90.72 })
  })

  it('converts the target weight when switching units', async () => {
    mockGoals(GOALS)
    renderWithProviders(<Settings />)
    const user = userEvent.setup()

    await waitFor(() =>
      expect(screen.getByLabelText('Target weight (kg)')).toHaveProperty('value', '80'),
    )
    await user.selectOptions(screen.getByLabelText('Units'), 'lb')

    expect(screen.getByLabelText('Target weight (lb)')).toHaveProperty('value', '176.4')
  })

  it('suggests macros from the latest bodyweight in kg', async () => {
    mockGoals({ ...GOALS, unit: 'lb' })
    mockCollection('body', [CHECK_IN])
    renderWithProviders(<Settings />)
    const user = userEvent.setup()

    const suggest = screen.getByRole('button', { name: 'Suggest macros from bodyweight' })
    await waitFor(() => expect(suggest).toHaveProperty('disabled', false))
    await user.click(suggest)

    expect(screen.getByLabelText('Protein (g)')).toHaveProperty('value', '198')
    expect(screen.getByLabelText('Fat (g)')).toHaveProperty('value', '81')
  })
})

describe('your data', () => {
  afterEach(() => vi.restoreAllMocks())

  const BACKUP: AppData = {
    version: 1,
    workouts: [],
    foods: [],
    body: [CHECK_IN],
    health: [],
    goals: GOALS,
  }

  function mockImport() {
    const imports: { search: string; body: unknown }[] = []
    server.use(
      http.post('/api/v1/backup/import', async ({ request }) => {
        imports.push({ search: new URL(request.url).search, body: await request.json() })
        return HttpResponse.json({ imported: {}, skipped: {} })
      }),
    )
    return imports
  }

  it('counts the stored data', async () => {
    mockCollection('body', [CHECK_IN])
    renderWithProviders(<Settings />)

    expect(
      await screen.findByText('0 workouts · 0 food entries · 1 check-ins · 0 health logs'),
    ).toBeDefined()
  })

  it('downloads the backup from the API', async () => {
    server.use(http.get('/api/v1/backup', () => HttpResponse.json(BACKUP)))
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup')
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderWithProviders(<Settings />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Export backup' }))

    expect(await screen.findByText('Backup downloaded.')).toBeDefined()
    expect(click).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(JSON.parse(await blob.text())).toEqual(BACKUP)
  })

  function uploadBackup(user: ReturnType<typeof userEvent.setup>) {
    const file = new File([JSON.stringify(BACKUP)], 'backup.json', { type: 'application/json' })
    return user.upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, file)
  }

  it('imports a backup file, merging by default', async () => {
    const imports = mockImport()
    renderWithProviders(<Settings />)

    await uploadBackup(userEvent.setup())

    expect(await screen.findByText('Data imported.')).toBeDefined()
    expect(imports).toEqual([{ search: '?mode=merge&unitHint=kg', body: BACKUP }])
  })

  it('replace requires confirmation', async () => {
    const imports = mockImport()
    renderWithProviders(<Settings />)
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText('Import mode'), 'replace')
    await uploadBackup(user)

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Replace all your current data with this backup? This can’t be undone.',
    })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
    expect(dialog).toBeDefined()
    expect(imports).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Yes, continue' }))

    expect(await screen.findByText('Data imported.')).toBeDefined()
    expect(imports).toEqual([{ search: '?mode=replace&unitHint=kg', body: BACKUP }])
  })

  it('does not replace the data when the confirmation is cancelled', async () => {
    const imports = mockImport()
    renderWithProviders(<Settings />)
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText('Import mode'), 'replace')
    await uploadBackup(user)
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(imports).toEqual([])
  })

  it('shows the error when the import fails', async () => {
    server.use(
      http.post('/api/v1/backup/import', () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'Bad Request', status: 400, detail: 'Invalid backup' },
          { status: 400 },
        ),
      ),
    )
    renderWithProviders(<Settings />)

    await uploadBackup(userEvent.setup())

    expect(await screen.findByText('Invalid backup')).toBeDefined()
  })

  it('rejects an invalid backup file', async () => {
    renderWithProviders(<Settings />)
    const file = new File(['not json'], 'backup.json', { type: 'application/json' })

    await userEvent
      .setup()
      .upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, file)

    expect(await screen.findByText('That file is not a valid IronLog backup.')).toBeDefined()
  })

  it('loads demo data after confirmation', async () => {
    const imports = mockImport()
    renderWithProviders(<Settings />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Load demo data' }))
    await user.click(screen.getByRole('button', { name: 'Yes, continue' }))

    expect(await screen.findByText('Demo data loaded.')).toBeDefined()
    expect(imports[0].search).toBe('?mode=replace&unitHint=kg')
    const body = imports[0].body as AppData
    expect(body.workouts.length).toBeGreaterThan(0)
    expect(body.body.length).toBeGreaterThan(0)
  })

  it.each([
    [
      'fails',
      () => HttpResponse.json({ title: 'Internal Server Error', status: 500 }, { status: 500 }),
      'error',
    ],
    ['is still loading', () => delay('infinite'), 'pending'],
  ])('cannot clear all logs while GET /goals %s', async (_, resolver, status) => {
    let calls = 0
    server.use(
      http.get('/api/v1/goals', resolver),
      http.post('/api/v1/backup/import', () => {
        calls += 1
        return HttpResponse.json({ imported: {}, skipped: {} })
      }),
    )
    const queryClient = renderWithProviders(<Settings />)
    const clear = screen.getByRole('button', { name: 'Clear all logs' })
    await waitFor(() => expect(queryClient.getQueryState(['goals'])?.status).toBe(status))

    expect(clear).toHaveProperty('disabled', true)
    await userEvent.setup().click(clear)
    expect(screen.queryByRole('button', { name: 'Yes, continue' })).toBeNull()
    expect(calls).toBe(0)
  })

  it('clears all logs but keeps the targets', async () => {
    const imports = mockImport()
    renderWithProviders(<Settings />)
    const user = userEvent.setup()
    await waitFor(() =>
      expect(screen.getByLabelText('Calories (kcal)')).toHaveProperty('value', '2500'),
    )

    await user.click(screen.getByRole('button', { name: 'Clear all logs' }))
    await user.click(screen.getByRole('button', { name: 'Yes, continue' }))

    expect(await screen.findByText('All logs cleared.')).toBeDefined()
    expect(imports[0]).toEqual({
      search: '?mode=replace&unitHint=kg',
      body: { version: 1, workouts: [], foods: [], body: [], health: [], goals: GOALS },
    })
  })
})

describe('delete account', () => {
  async function openConfirm() {
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Delete account' }))
    return user
  }

  it('asks for confirmation and the password, then ends the session', async () => {
    let body: unknown
    server.use(
      http.delete('/api/v1/auth/account', async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const queryClient = renderApp('/settings')
    const user = await openConfirm()

    expect(screen.getByText(/Permanently delete your account/)).toBeDefined()
    expect(document.activeElement).toBe(screen.getByLabelText('Password'))
    await user.keyboard('my password{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeDefined()
    expect(body).toEqual({ password: 'my password' })
    expect(queryClient.getQueryData(SESSION_KEY)).toBeNull()
  })

  it('requires the password', async () => {
    renderApp('/settings')
    const user = await openConfirm()
    await user.click(screen.getByRole('button', { name: 'Delete my account' }))

    const password = screen.getByLabelText('Password')
    expect(password.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(password.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Enter your password',
    )
  })

  it('shows a wrong password inline', async () => {
    server.use(
      http.delete('/api/v1/auth/account', () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Invalid password' },
          { status: 401 },
        ),
      ),
    )
    renderApp('/settings')
    const user = await openConfirm()
    await user.keyboard('wrong{Enter}')

    expect((await screen.findByRole('alert')).textContent).toBe('Invalid password')
  })

  it('can be cancelled', async () => {
    renderApp('/settings')
    const user = await openConfirm()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByLabelText('Password')).toBeNull()
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeDefined()
  })
})
