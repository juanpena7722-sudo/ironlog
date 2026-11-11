import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { SESSION_KEY } from '../api/auth'
import { renderApp, renderWithProviders } from '../test/render'
import { server } from '../test/setup'
import Settings from './Settings'

it('Settings page renders', () => {
  renderWithProviders(<Settings />)
  expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeDefined()
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
