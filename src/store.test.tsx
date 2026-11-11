import { describe, expect, test } from 'vitest'
import { DEFAULT_GOALS, normalize } from './store'
import type { AppData } from './types'

describe('normalize', () => {
  test('fills every field for empty input', () => {
    expect(normalize({})).toEqual({
      version: 1,
      workouts: [],
      foods: [],
      body: [],
      health: [],
      goals: DEFAULT_GOALS,
    })
  })

  test('replaces non-array collections with empty arrays', () => {
    const input = { workouts: 'x', foods: null, body: {}, health: 3 } as unknown as Partial<AppData>
    const result = normalize(input)
    expect([result.workouts, result.foods, result.body, result.health]).toEqual([[], [], [], []])
  })

  test('keeps existing collections and merges goals over defaults', () => {
    const body = [{ id: 'b1', date: '2026-03-02', weight: 82 }]
    const result = normalize({ body, goals: { ...DEFAULT_GOALS, calories: 2500, unit: 'lb' } })
    expect(result.body).toBe(body)
    expect(result.goals).toEqual({ ...DEFAULT_GOALS, calories: 2500, unit: 'lb' })
  })

  test('fills goal fields missing from older data', () => {
    const goals = { calories: 2000 } as AppData['goals']
    expect(normalize({ goals }).goals).toEqual({ ...DEFAULT_GOALS, calories: 2000 })
  })

  test('always sets version 1', () => {
    expect(normalize({ version: 7 } as unknown as Partial<AppData>).version).toBe(1)
  })
})
