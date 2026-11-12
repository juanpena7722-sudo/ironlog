import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import type { ComponentType } from 'react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../test/render'
import { server } from '../test/setup'
import Dashboard from './Dashboard'
import Diet from './Diet'
import Health from './Health'
import Progress from './Progress'
import Settings from './Settings'
import Workouts from './Workouts'

type User = ReturnType<typeof userEvent.setup>

const PAGES: [string, ComponentType, string, string][] = [
  ['Dashboard', Dashboard, '/api/v1/workouts', 'Welcome to IronLog 🏋️'],
  ['Workouts', Workouts, '/api/v1/workouts', 'No workouts yet. Hit “Log workout” to start.'],
  ['Diet', Diet, '/api/v1/foods', 'Nothing logged for this day.'],
  ['Progress', Progress, '/api/v1/body', 'No check-ins yet.'],
  ['Health', Health, '/api/v1/health-entries', 'No health logs yet.'],
  [
    'Settings',
    Settings,
    '/api/v1/workouts',
    '0 workouts · 0 food entries · 0 check-ins · 0 health logs',
  ],
]

const problem = (status: number, title: string, detail: string) =>
  HttpResponse.json({ type: 'about:blank', title, status, detail }, { status })

describe.each(PAGES)('%s page states', (_, Page, endpoint, emptyText) => {
  it('shows loading until the data arrives', async () => {
    server.use(http.get(endpoint, () => delay('infinite')))
    renderWithProviders(<Page />)

    expect((await screen.findByText('Loading…')).getAttribute('role')).toBe('status')
    expect(screen.queryByText(emptyText)).toBeNull()
  })

  it('shows an error with retry, then the data after a retry', async () => {
    server.use(
      http.get(endpoint, () => problem(500, 'Internal Server Error', 'Database unavailable'), {
        once: true,
      }),
    )
    renderWithProviders(<Page />)

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not load your data. Database unavailable',
    )
    expect(screen.queryByText(emptyText)).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText(emptyText)).toBeDefined()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the empty state when there is no data', async () => {
    renderWithProviders(<Page />)

    expect(await screen.findByText(emptyText)).toBeDefined()
  })
})

type Save = [string, ComponentType, 'post' | 'put', string, (user: User) => Promise<void>, string]

const SAVES: Save[] = [
  [
    'Workouts',
    Workouts,
    'post',
    '/api/v1/workouts',
    async (user) => {
      await user.click(await screen.findByRole('button', { name: '+ Log workout' }))
      await user.type(screen.getByLabelText('Exercise 1 name'), 'Squat')
      await user.click(screen.getByRole('button', { name: 'Save workout' }))
    },
    'Workout saved.',
  ],
  [
    'Diet',
    Diet,
    'post',
    '/api/v1/foods',
    async (user) => {
      await user.type(await screen.findByLabelText('Food'), 'Rice')
      await user.click(screen.getByRole('button', { name: 'Add' }))
    },
    'Food added.',
  ],
  [
    'Progress',
    Progress,
    'post',
    '/api/v1/body',
    async (user) => {
      await user.type(await screen.findByLabelText('Weight (kg) *'), '80')
      await user.click(screen.getByRole('button', { name: 'Save check-in' }))
    },
    'Check-in saved.',
  ],
  [
    'Health',
    Health,
    'put',
    '/api/v1/health-entries/:date',
    async (user) => {
      await user.type(await screen.findByLabelText('Sleep (h)'), '8')
      await user.click(screen.getByRole('button', { name: 'Save day' }))
    },
    'Day saved.',
  ],
  [
    'Settings',
    Settings,
    'put',
    '/api/v1/goals',
    async (user) => {
      const save = await screen.findByRole('button', { name: 'Save targets' })
      await waitFor(() => expect(save).toHaveProperty('disabled', false))
      await user.click(save)
    },
    'Targets saved.',
  ],
]

describe.each(SAVES)('%s save feedback', (_, Page, method, endpoint, save, successText) => {
  it('announces a successful save', async () => {
    server.use(
      http[method](endpoint, async ({ request }) =>
        HttpResponse.json({ id: crypto.randomUUID(), ...((await request.json()) as object) }),
      ),
    )
    renderWithProviders(<Page />)

    await save(userEvent.setup())

    expect((await screen.findByText(successText)).getAttribute('role')).toBe('status')
  })

  it('shows the error when the save fails', async () => {
    server.use(http[method](endpoint, () => problem(400, 'Bad Request', 'Invalid entry')))
    renderWithProviders(<Page />)

    await save(userEvent.setup())

    expect((await screen.findByRole('alert')).textContent).toBe('Invalid entry')
    expect(screen.queryByText(successText)).toBeNull()
  })
})
