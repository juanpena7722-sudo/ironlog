import { http, HttpResponse } from 'msw'
import type { Goals, User } from '@shared/schemas'

export const USER: User = {
  id: '3f0c1a52-8d4e-4b7a-9c1e-2a6b5d7e8f90',
  email: 'lifter@example.com',
}

export const GOALS: Goals = {
  unit: 'kg',
  calories: 2500,
  protein: 180,
  carbs: 250,
  fat: 80,
  targetWeight: 80,
  waterL: 3,
  sleepHours: 8,
}

export const handlers = [
  http.get('/api/v1/goals', () => HttpResponse.json(GOALS)),
  ...['workouts', 'foods', 'foods/recent', 'body', 'health-entries'].map((path) =>
    http.get(`/api/v1/${path}`, () => HttpResponse.json([])),
  ),
  http.get('/api/v1/auth/me', () => HttpResponse.json(USER)),
]
