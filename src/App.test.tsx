import type { QueryClient } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, test } from 'vitest'
import { SESSION_KEY } from './api/auth'
import { GOALS, USER } from './test/handlers'
import { renderApp } from './test/render'
import { server } from './test/setup'

const NOT_AUTHENTICATED = HttpResponse.json(
  { type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Not authenticated' },
  { status: 401 },
)

test.each([
  ['/', 'Dashboard'],
  ['/workouts', 'Workouts'],
  ['/diet', 'Diet'],
  ['/progress', 'Progress'],
  ['/health', 'Health'],
  ['/settings', 'Settings'],
])('route %s lazy-loads the %s page', async (path, name) => {
  renderApp(path)
  expect(screen.getByText('Loading…')).toBeDefined()
  expect(await screen.findByRole('heading', { level: 1, name })).toBeDefined()
})

describe('protected routes', () => {
  it('redirects a 401 to login, then back to the original page after login', async () => {
    server.use(
      http.get('/api/v1/auth/me', () => NOT_AUTHENTICATED.clone()),
      http.post('/api/v1/auth/login', () => HttpResponse.json(USER)),
    )
    renderApp('/workouts')
    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeDefined()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), USER.email)
    await user.type(screen.getByLabelText('Password'), 'correct horse{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: 'Workouts' })).toBeDefined()
  })

  it('shows an error with retry when the session check fails', async () => {
    let calls = 0
    server.use(
      http.get('/api/v1/auth/me', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json({ title: 'Internal Server Error', status: 500 }, { status: 500 })
          : HttpResponse.json(USER)
      }),
    )
    renderApp('/health')
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Could not check your session.',
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Health' })).toBeDefined()
  })
})

describe('logout', () => {
  it('clears the session and the query cache, then shows login', async () => {
    server.use(http.post('/api/v1/auth/logout', () => new HttpResponse(null, { status: 204 })))
    const queryClient = renderApp('/')
    queryClient.setQueryData(['goals'], GOALS)
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeDefined()
    expect(queryClient.getQueryData(SESSION_KEY)).toBeNull()
    expect(queryClient.getQueryData(['goals'])).toBeUndefined()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1)
  })

  it('shows the error when logout fails', async () => {
    server.use(http.post('/api/v1/auth/logout', () => HttpResponse.error()))
    renderApp('/')
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Something went wrong. Please try again.',
    )
  })
})

describe('session expiry', () => {
  function expectLoggedOut(queryClient: QueryClient) {
    expect(queryClient.getQueryData(SESSION_KEY)).toBeNull()
    const observed = queryClient.getQueryCache().findAll({ type: 'active' })
    expect(observed.map((query) => query.queryKey)).toEqual([SESSION_KEY])
  }

  it('sends the user to login when a data query returns 401', async () => {
    server.use(http.get('/api/v1/workouts', () => NOT_AUTHENTICATED.clone()))
    const queryClient = renderApp('/workouts')

    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeDefined()
    expectLoggedOut(queryClient)
  })

  it('sends the user to login when a mutation returns 401', async () => {
    server.use(http.put('/api/v1/health-entries/:date', () => NOT_AUTHENTICATED.clone()))
    const queryClient = renderApp('/health')

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Save day' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeDefined()
    expectLoggedOut(queryClient)
  })

  it('starts the next session without the previous user data', async () => {
    let isExpired = true
    server.use(
      http.get('/api/v1/workouts', () =>
        isExpired ? NOT_AUTHENTICATED.clone() : HttpResponse.json([]),
      ),
      http.post('/api/v1/auth/login', () => HttpResponse.json(USER)),
    )
    const queryClient = renderApp('/workouts')
    await screen.findByRole('heading', { level: 1, name: 'Log in' })
    queryClient.setQueryData(['workouts', 'from=2026-01-01'], [])
    isExpired = false

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), USER.email)
    await user.type(screen.getByLabelText('Password'), 'correct horse{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: 'Workouts' })).toBeDefined()
    expect(queryClient.getQueryData(['workouts', 'from=2026-01-01'])).toBeUndefined()
  })
})
