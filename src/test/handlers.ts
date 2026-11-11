import { http, HttpResponse } from 'msw'
import type { Goals } from '@shared/schemas'

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

export const handlers = [http.get('/api/v1/goals', () => HttpResponse.json(GOALS))]
