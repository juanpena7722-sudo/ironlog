import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Workout } from '../types'
import { GOALS } from '../test/handlers'
import { mockCollection, mockGoals } from '../test/mockApi'
import { renderWithProviders } from '../test/render'
import Workouts from './Workouts'

const PUSH: Workout = {
  id: '6b1f8a0e-0c4f-4a51-9d62-5b0d5d1f3a10',
  date: '2026-03-02',
  name: 'Push day',
  exercises: [
    {
      id: '0d6f1c1a-9a55-4c1e-8f3b-1f6f9b5e2a20',
      name: 'Bench Press',
      muscle: 'Chest',
      sets: [{ reps: 5, weight: 100 }],
    },
  ],
}

async function openHistoryItem(name: string) {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: new RegExp(`^${name}`) }))
  return user
}

describe('Workouts', () => {
  it('lists workouts from the API with their PRs', async () => {
    const api = mockCollection('workouts', [PUSH])
    renderWithProviders(<Workouts />)

    expect(await screen.findByText('Push day')).toBeDefined()
    const prs = screen.getByRole('table')
    expect(within(prs).getByText('Bench Press')).toBeDefined()
    expect(within(prs).getByText('100 × 5')).toBeDefined()
    expect(api.requests[0].url.searchParams.get('from')).toBe('1970-01-01')
  })

  it('creates a workout', async () => {
    const api = mockCollection<Workout>('workouts', [])
    renderWithProviders(<Workouts />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '+ Log workout' }))
    await user.type(screen.getByLabelText('Name'), 'Legs')
    await user.type(screen.getByPlaceholderText('Exercise (e.g. Bench Press)'), 'Squat')
    const [, weight] = screen.getAllByRole('spinbutton')
    await user.clear(weight)
    await user.type(weight, '140')
    await user.click(screen.getByRole('button', { name: 'Save workout' }))

    expect(await screen.findByRole('button', { name: /^Legs/ })).toBeDefined()
    const post = api.requests.find((r) => r.method === 'POST')
    expect(post?.body).toMatchObject({
      name: 'Legs',
      exercises: [{ name: 'Squat', muscle: 'Chest', sets: [{ reps: 8, weight: 140 }] }],
    })
  })

  it('explains why a workout without a named exercise is not saved', async () => {
    const api = mockCollection<Workout>('workouts', [])
    renderWithProviders(<Workouts />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: '+ Log workout' }))
    await user.click(screen.getByRole('button', { name: 'Save workout' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Add at least one exercise with a name.')
    const exercise = screen.getByLabelText('Exercise 1 name')
    expect(exercise.getAttribute('aria-invalid')).toBe('true')
    expect(exercise.getAttribute('aria-describedby')).toBe(alert.id)
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeDefined()
    expect(api.requests.filter((r) => r.method !== 'GET')).toEqual([])

    await user.type(exercise, 'Squat')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(exercise.getAttribute('aria-invalid')).toBeNull()
  })

  it('edits a workout', async () => {
    const api = mockCollection('workouts', [PUSH])
    renderWithProviders(<Workouts />)
    const user = await openHistoryItem('Push day')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('heading', { name: 'Edit workout' })).toBeDefined()
    const name = screen.getByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Chest day')
    await user.click(screen.getByRole('button', { name: 'Save workout' }))

    expect(await screen.findByRole('button', { name: /^Chest day/ })).toBeDefined()
    const put = api.requests.find((r) => r.method === 'PUT')
    expect(put?.url.pathname).toBe(`/api/v1/workouts/${PUSH.id}`)
    expect(put?.body).toMatchObject({ name: 'Chest day', exercises: [{ sets: [{ weight: 100 }] }] })
  })

  it('deletes a workout', async () => {
    const api = mockCollection('workouts', [PUSH])
    renderWithProviders(<Workouts />)
    const user = await openHistoryItem('Push day')

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('No workouts yet. Hit “Log workout” to start.')).toBeDefined()
    expect(screen.getByRole('status').textContent).toBe('Workout deleted.')
    expect(api.requests.find((r) => r.method === 'DELETE')?.url.pathname).toBe(
      `/api/v1/workouts/${PUSH.id}`,
    )
  })

  it('shows and saves weights in lb, stored as kg', async () => {
    mockGoals({ ...GOALS, unit: 'lb' })
    const api = mockCollection('workouts', [PUSH])
    renderWithProviders(<Workouts />)
    const user = await openHistoryItem('Push day')
    expect(await screen.findByText('220.5 × 5')).toBeDefined()
    expect(screen.getByText(/220.5×5/)).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('columnheader', { name: 'Weight (lb)' })).toBeDefined()
    const [, weight] = screen.getAllByRole('spinbutton')
    expect(weight).toHaveProperty('value', '220.5')
    await user.clear(weight)
    await user.type(weight, '225')
    await user.click(screen.getByRole('button', { name: 'Save workout' }))

    await screen.findByText(/225×5/)
    const put = api.requests.find((r) => r.method === 'PUT')
    expect(put?.body).toMatchObject({ exercises: [{ sets: [{ weight: 102.06 }] }] })
  })
})
