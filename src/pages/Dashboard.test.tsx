import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { BodyEntry, FoodEntry, HealthEntry, Workout } from '../types'
import { GOALS } from '../test/handlers'
import { mockCollection, mockGoals } from '../test/mockApi'
import { renderWithProviders } from '../test/render'
import { daysAgo, today } from '../utils'
import Dashboard from './Dashboard'

const WORKOUT: Workout = {
  id: '5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  date: today(),
  name: 'Pull day',
  exercises: [
    {
      id: '6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
      name: 'Row',
      muscle: 'Back',
      sets: [{ reps: 10, weight: 100 }],
    },
  ],
}
const FOOD: FoodEntry = {
  id: '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  date: today(),
  meal: 'Lunch',
  name: 'Rice',
  calories: 600,
  protein: 30,
  carbs: 100,
  fat: 5,
}
const BODY: BodyEntry[] = [
  { id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', date: daysAgo(8), weight: 80 },
  { id: '9a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', date: today(), weight: 81 },
]
const HEALTH: HealthEntry = {
  id: 'aa1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  date: today(),
  sleepHours: 7,
}

function mockAll() {
  mockCollection('workouts', [WORKOUT])
  mockCollection('foods', [FOOD])
  mockCollection('body', BODY)
  mockCollection('health-entries', [HEALTH], 'date')
}

describe('Dashboard', () => {
  it('shows a welcome when there is no data', async () => {
    renderWithProviders(<Dashboard />)
    expect(await screen.findByText('Welcome to IronLog 🏋️')).toBeDefined()
  })

  it('summarises data from the API', async () => {
    mockAll()
    renderWithProviders(<Dashboard />)

    expect(await screen.findByText('81 kg')).toBeDefined()
    expect(await screen.findByText('+1 kg this week')).toBeDefined()
    expect(await screen.findByText('600', { selector: '.stat-value' })).toBeDefined()
    expect(await screen.findByText('7 h')).toBeDefined()
    expect(await screen.findByText('Pull day')).toBeDefined()
    expect(await screen.findByText('1,000 kg volume')).toBeDefined()
  })

  it('converts weights to lb', async () => {
    mockGoals({ ...GOALS, unit: 'lb' })
    mockAll()
    renderWithProviders(<Dashboard />)

    expect(await screen.findByText('178.6 lb')).toBeDefined()
    expect(await screen.findByText('+2.2 lb this week')).toBeDefined()
    expect(await screen.findByText('2,205 lb volume')).toBeDefined()
  })
})
