import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { FoodEntry, Workout } from './types'
import {
  byDateAsc,
  byDateDesc,
  daysAgo,
  e1rm,
  exerciseVolume,
  fmtDate,
  fmtLongDate,
  lastNDays,
  num,
  round,
  today,
  totals,
  uid,
  weekStart,
  workoutVolume,
} from './utils'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 2, 2, 12))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('uid', () => {
  test('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'fixed-uuid' })
    expect(uid()).toBe('fixed-uuid')
  })

  test('falls back when crypto has no randomUUID', () => {
    vi.stubGlobal('crypto', {})
    expect(uid()).toMatch(/^[a-z0-9]+$/)
  })

  test('falls back when crypto is undefined', () => {
    vi.stubGlobal('crypto', undefined)
    expect(uid()).not.toBe(uid())
  })
})

describe('dates', () => {
  test('today returns the local calendar day', () => {
    expect(today()).toBe('2026-03-02')
  })

  test('daysAgo crosses month boundaries', () => {
    expect(daysAgo(0)).toBe('2026-03-02')
    expect(daysAgo(2)).toBe('2026-02-28')
  })

  test('lastNDays lists days oldest first, ending today', () => {
    expect(lastNDays(3)).toEqual(['2026-02-28', '2026-03-01', '2026-03-02'])
    expect(lastNDays(0)).toEqual([])
  })

  test('fmtDate formats month and day', () => {
    expect(fmtDate('2026-01-05')).toBe(
      new Date(2026, 0, 5).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    )
  })

  test('fmtLongDate formats weekday, month, day and year', () => {
    expect(fmtLongDate('2026-01-05')).toBe(
      new Date(2026, 0, 5).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    )
  })

  test('weekStart returns the Monday of the week', () => {
    expect(weekStart('2026-03-02')).toBe('2026-03-02')
    expect(weekStart('2026-03-04')).toBe('2026-03-02')
    expect(weekStart('2026-03-01')).toBe('2026-02-23')
  })
})

describe('e1rm', () => {
  test('returns 0 for no reps', () => {
    expect(e1rm(100, 0)).toBe(0)
  })

  test('returns the weight for a single rep', () => {
    expect(e1rm(100, 1)).toBe(100)
  })

  test('applies the Epley formula for multiple reps', () => {
    expect(e1rm(100, 6)).toBeCloseTo(120)
  })
})

describe('volume', () => {
  const workout: Workout = {
    id: 'w1',
    date: '2026-03-02',
    name: 'Push',
    exercises: [
      {
        id: 'e1',
        name: 'Bench Press',
        muscle: 'Chest',
        sets: [
          { reps: 5, weight: 100 },
          { reps: 5, weight: 90 },
        ],
      },
      { id: 'e2', name: 'Dips', muscle: 'Triceps', sets: [{ reps: 10, weight: 0 }] },
    ],
  }

  test('exerciseVolume sums reps times weight', () => {
    expect(exerciseVolume(workout.exercises[0])).toBe(950)
  })

  test('workoutVolume sums all exercises', () => {
    expect(workoutVolume(workout)).toBe(950)
    expect(workoutVolume({ ...workout, exercises: [] })).toBe(0)
  })
})

describe('round', () => {
  test('defaults to one decimal place', () => {
    expect(round(1.26)).toBe(1.3)
  })

  test('uses the given decimal places', () => {
    expect(round(1.256, 2)).toBe(1.26)
    expect(round(1.5, 0)).toBe(2)
  })
})

describe('num', () => {
  test('returns undefined for blank input', () => {
    expect(num('')).toBeUndefined()
    expect(num('   ')).toBeUndefined()
  })

  test('parses finite numbers', () => {
    expect(num('12.5')).toBe(12.5)
    expect(num(' 3 ')).toBe(3)
  })

  test('returns undefined for non-finite input', () => {
    expect(num('abc')).toBeUndefined()
    expect(num('Infinity')).toBeUndefined()
  })
})

describe('date sorters', () => {
  const items = [{ date: '2026-03-02' }, { date: '2026-01-01' }, { date: '2026-02-15' }]

  test('byDateAsc sorts oldest first', () => {
    expect([...items].sort(byDateAsc).map((i) => i.date)).toEqual([
      '2026-01-01',
      '2026-02-15',
      '2026-03-02',
    ])
  })

  test('byDateDesc sorts newest first', () => {
    expect([...items].sort(byDateDesc).map((i) => i.date)).toEqual([
      '2026-03-02',
      '2026-02-15',
      '2026-01-01',
    ])
  })
})

describe('totals', () => {
  test('returns zeros for no entries', () => {
    expect(totals([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })

  test('sums calories and macros', () => {
    const entries: FoodEntry[] = [
      {
        id: 'f1',
        date: '2026-03-02',
        meal: 'Breakfast',
        name: 'Oats',
        calories: 300,
        protein: 10,
        carbs: 50,
        fat: 6,
      },
      {
        id: 'f2',
        date: '2026-03-02',
        meal: 'Lunch',
        name: 'Chicken',
        calories: 250,
        protein: 45,
        carbs: 0,
        fat: 7,
      },
    ]
    expect(totals(entries)).toEqual({ calories: 550, protein: 55, carbs: 50, fat: 13 })
  })
})
