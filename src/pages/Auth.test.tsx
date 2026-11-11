import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { USER } from '../test/handlers'
import { renderApp } from '../test/render'
import { server } from '../test/setup'

function problem(status: number, title: string, detail: string) {
  return HttpResponse.json({ type: 'about:blank', title, status, detail }, { status })
}

beforeEach(() => {
  server.use(http.get('/api/v1/auth/me', () => problem(401, 'Unauthorized', 'Not authenticated')))
})

describe('login', () => {
  it('logs in with the keyboard and redirects to the dashboard', async () => {
    let body: unknown
    server.use(
      http.post('/api/v1/auth/login', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(USER)
      }),
    )
    renderApp('/login')
    const user = userEvent.setup()
    await screen.findByRole('heading', { level: 1, name: 'Log in' })

    await user.tab()
    expect(document.activeElement).toBe(screen.getByLabelText('Email'))
    await user.keyboard(' Lifter@Example.com ')
    await user.tab()
    expect(document.activeElement).toBe(screen.getByLabelText('Password'))
    await user.keyboard('correct horse{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined()
    expect(body).toEqual({ email: 'lifter@example.com', password: 'correct horse' })
  })

  it('shows validation messages and focuses the first invalid field', async () => {
    renderApp('/login')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Log in' }))

    const email = screen.getByLabelText('Email')
    const password = screen.getByLabelText('Password')
    expect(email.getAttribute('aria-invalid')).toBe('true')
    expect(password.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(email.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Enter a valid email address',
    )
    expect(document.getElementById(password.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Enter your password',
    )
    expect(document.activeElement).toBe(email)
  })

  it('shows the server detail inline', async () => {
    server.use(
      http.post('/api/v1/auth/login', () =>
        problem(401, 'Unauthorized', 'Invalid email or password'),
      ),
    )
    renderApp('/login')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Email'), USER.email)
    await user.type(screen.getByLabelText('Password'), 'wrong password{Enter}')

    expect((await screen.findByRole('alert')).textContent).toBe('Invalid email or password')
  })

  it('redirects to the dashboard when already logged in', async () => {
    server.use(http.get('/api/v1/auth/me', () => HttpResponse.json(USER)))
    renderApp('/login')
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined()
  })
})

describe('register', () => {
  it('creates an account and redirects to the dashboard', async () => {
    server.use(http.post('/api/v1/auth/register', () => HttpResponse.json(USER, { status: 201 })))
    renderApp('/register')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Email'), USER.email)
    await user.type(screen.getByLabelText('Password'), 'long enough password{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined()
  })

  it('requires a password of at least 10 characters', async () => {
    renderApp('/register')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Email'), USER.email)
    await user.type(screen.getByLabelText('Password'), 'short{Enter}')

    const password = screen.getByLabelText('Password')
    expect(password.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(password.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Password must be at least 10 characters',
    )
    expect(document.activeElement).toBe(password)
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBeNull()
  })

  it('shows a conflict from the server inline', async () => {
    server.use(
      http.post('/api/v1/auth/register', () =>
        problem(409, 'Conflict', 'Email already registered'),
      ),
    )
    renderApp('/register')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Email'), USER.email)
    await user.type(screen.getByLabelText('Password'), 'long enough password{Enter}')

    expect((await screen.findByRole('alert')).textContent).toBe('Email already registered')
  })

  it('links to login keeping the page to return to', async () => {
    server.use(http.post('/api/v1/auth/login', () => HttpResponse.json(USER)))
    renderApp('/diet')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('link', { name: 'Create one' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Create account' })).toBeDefined()
    await user.click(screen.getByRole('link', { name: 'Log in' }))

    await user.type(await screen.findByLabelText('Email'), USER.email)
    await user.type(screen.getByLabelText('Password'), 'correct horse{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: 'Diet' })).toBeDefined()
  })
})
