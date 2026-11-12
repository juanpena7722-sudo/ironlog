import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { BodyEntry } from '../types'
import { GOALS } from '../test/handlers'
import { mockCollection, mockGoals } from '../test/mockApi'
import { renderApp, renderWithProviders } from '../test/render'
import { fmtDate, today } from '../utils'
import Progress from './Progress'

const CHECK_IN: BodyEntry = {
  id: '4e2d9c1b-7a6f-4b3e-9d2c-1a0b9c8d7e6f',
  date: '2026-03-02',
  weight: 82.5,
  waist: 81,
}

const rows = () => within(screen.getAllByRole('table')[0]).getAllByRole('row').slice(1)

describe('Progress', () => {
  it('lists check-ins', async () => {
    mockCollection('body', [CHECK_IN])
    renderWithProviders(<Progress />)

    expect(await screen.findByText('82.5 kg')).toBeDefined()
    expect(rows()).toHaveLength(1)
    expect(within(rows()[0]).getByText('81')).toBeDefined()
  })

  it('creates a check-in', async () => {
    const api = mockCollection<BodyEntry>('body', [])
    renderWithProviders(<Progress />)
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('Weight (kg) *'), '80.4')
    await user.type(screen.getByLabelText('Waist (cm)'), '79')
    await user.click(screen.getByRole('button', { name: 'Save check-in' }))

    expect(await screen.findAllByText('80.4 kg')).toHaveLength(2)
    expect(api.requests.find((r) => r.method === 'POST')?.body).toMatchObject({
      date: today(),
      weight: 80.4,
      waist: 79,
    })
  })

  it('edits the check-in of the same day', async () => {
    const api = mockCollection('body', [CHECK_IN])
    renderWithProviders(<Progress />)
    const user = userEvent.setup()
    await screen.findByText('82.5 kg')

    const date = screen.getByLabelText('Date')
    await user.clear(date)
    await user.type(date, CHECK_IN.date)
    await user.type(screen.getByLabelText('Weight (kg) *'), '82')
    await user.click(screen.getByRole('button', { name: 'Save check-in' }))

    expect(await screen.findByText('82 kg')).toBeDefined()
    expect(rows()).toHaveLength(1)
    const put = api.requests.find((r) => r.method === 'PUT')
    expect(put?.url.pathname).toBe(`/api/v1/body/${CHECK_IN.id}`)
    expect(put?.body).toMatchObject({ date: CHECK_IN.date, weight: 82 })
  })

  it('deletes a check-in', async () => {
    const api = mockCollection('body', [CHECK_IN])
    renderWithProviders(<Progress />)

    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: `Delete ${fmtDate(CHECK_IN.date)}` }))

    expect(await screen.findByText('No check-ins yet.')).toBeDefined()
    expect(screen.getByRole('status').textContent).toBe('Check-in deleted.')
    expect(api.requests.find((r) => r.method === 'DELETE')?.url.pathname).toBe(
      `/api/v1/body/${CHECK_IN.id}`,
    )
  })

  it('shows measurements in inches and saves them in cm', async () => {
    mockGoals({ ...GOALS, unit: 'lb' })
    const api = mockCollection('body', [CHECK_IN])
    renderWithProviders(<Progress />)
    const user = userEvent.setup()

    expect(await screen.findByText('181.9 lb')).toBeDefined()
    expect(within(rows()[0]).getByText('31.9')).toBeDefined()
    await user.type(screen.getByLabelText('Weight (lb) *'), '180')
    await user.type(screen.getByLabelText('Waist (in)'), '32')
    await user.click(screen.getByRole('button', { name: 'Save check-in' }))

    await screen.findAllByText('180 lb')
    expect(api.requests.find((r) => r.method === 'POST')?.body).toMatchObject({
      weight: 81.65,
      waist: 81.28,
    })
  })
})

it('saves 100 lb as 45.36 kg and shows 45.4 after switching to kg', async () => {
  const goals = mockGoals({ ...GOALS, unit: 'lb' })
  const api = mockCollection<BodyEntry>('body', [])
  renderApp('/progress')
  const user = userEvent.setup()

  await user.type(await screen.findByLabelText('Weight (lb) *'), '100')
  await user.click(screen.getByRole('button', { name: 'Save check-in' }))
  expect(await screen.findAllByText('100 lb')).toHaveLength(2)
  expect(api.requests.find((r) => r.method === 'POST')?.body).toMatchObject({ weight: 45.36 })

  await user.click(screen.getByRole('link', { name: /Settings/ }))
  await user.selectOptions(await screen.findByLabelText('Units'), 'kg')
  await user.click(screen.getByRole('button', { name: 'Save targets' }))
  await screen.findByText('Targets saved.')
  expect(goals.at(-1)).toMatchObject({ unit: 'kg', targetWeight: GOALS.targetWeight })

  await user.click(screen.getByRole('link', { name: /Progress/ }))
  expect(await screen.findAllByText('45.4 kg')).toHaveLength(2)
  expect(within(rows()[0]).getByText('45.4')).toBeDefined()
})
