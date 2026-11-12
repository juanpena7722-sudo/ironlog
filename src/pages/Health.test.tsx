import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { HealthEntry } from '../types'
import { mockCollection } from '../test/mockApi'
import { renderWithProviders } from '../test/render'
import { daysAgo, fmtDate, today } from '../utils'
import Health from './Health'

const TODAY: HealthEntry = {
  id: '2b3c4d5e-6f70-4812-9a3b-4c5d6e7f8091',
  date: today(),
  sleepHours: 7.5,
  waterL: 3,
  notes: 'Felt good',
}

describe('Health', () => {
  it('lists entries and fills the form with the stored day once loaded', async () => {
    mockCollection('health-entries', [TODAY], 'date')
    renderWithProviders(<Health />)

    expect(await screen.findByText('Felt good', { selector: 'td' })).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeDefined()
    expect(screen.getByLabelText('Sleep (h)')).toHaveProperty('value', '7.5')
    expect(screen.getByRole('button', { name: 'Update day' })).toBeDefined()
    expect(screen.getByText('7.5 h', { selector: '.stat-value' })).toBeDefined()
  })

  it('creates a day', async () => {
    const api = mockCollection<HealthEntry>('health-entries', [], 'date')
    renderWithProviders(<Health />)
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('Sleep (h)'), '8')
    await user.type(screen.getByLabelText('Steps'), '9000')
    await user.selectOptions(screen.getByLabelText('Energy'), '🔥 Great')
    await user.click(screen.getByRole('button', { name: 'Save day' }))

    expect(await screen.findByText('9,000')).toBeDefined()
    const put = api.requests.find((r) => r.method === 'PUT')
    expect(put?.url.pathname).toBe(`/api/v1/health-entries/${today()}`)
    expect(put?.body).toMatchObject({ date: today(), sleepHours: 8, steps: 9000, energy: 5 })
  })

  it('edits a past day picked from the history', async () => {
    const past = { ...TODAY, id: '3b3c4d5e-6f70-4812-9a3b-4c5d6e7f8091', date: daysAgo(2) }
    const api = mockCollection('health-entries', [past], 'date')
    renderWithProviders(<Health />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: fmtDate(past.date) }))
    const water = screen.getByLabelText('Water (L)')
    expect(water).toHaveProperty('value', '3')
    await user.clear(water)
    await user.type(water, '4')
    await user.click(screen.getByRole('button', { name: 'Update day' }))

    const table = screen.getByRole('table')
    expect(await within(table).findByText('4 L')).toBeDefined()
    const put = api.requests.find((r) => r.method === 'PUT')
    expect(put?.url.pathname).toBe(`/api/v1/health-entries/${past.date}`)
    expect(put?.body).toMatchObject({ waterL: 4, sleepHours: 7.5, notes: 'Felt good' })
  })

  it('deletes a day', async () => {
    const api = mockCollection('health-entries', [TODAY], 'date')
    renderWithProviders(<Health />)

    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: `Delete ${fmtDate(TODAY.date)}` }))

    expect(await screen.findByText('No health logs yet.')).toBeDefined()
    expect(screen.getByRole('status').textContent).toBe('Day deleted.')
    expect(api.requests.find((r) => r.method === 'DELETE')?.url.pathname).toBe(
      `/api/v1/health-entries/${TODAY.date}`,
    )
  })
})
