import { describe, expect, it } from 'vitest'
import {
  AppDataSchema,
  BodyEntrySchema,
  DeleteAccountSchema,
  ExerciseEntrySchema,
  FoodEntrySchema,
  GoalsSchema,
  HealthEntrySchema,
  ISODateSchema,
  LoginSchema,
  MEALS,
  MUSCLES,
  MealSchema,
  NAME_MAX,
  NOTES_MAX,
  RegisterSchema,
  SetEntrySchema,
  UnitSchema,
  UserSchema,
  WorkoutSchema,
  isRealISODate,
} from './schemas'
import type { AppData, BodyEntry, FoodEntry, Goals, HealthEntry, Workout } from './schemas'

const set = { reps: 8, weight: 100 }
const exercise = { id: 'ex-1', name: 'Bench Press', muscle: 'Chest', sets: [set] }
const workout: Workout = {
  id: 'w-1',
  date: '2026-11-08',
  name: 'Push day',
  durationMin: 60,
  notes: 'Felt strong',
  exercises: [exercise],
}
const food: FoodEntry = {
  id: 'f-1',
  date: '2026-11-08',
  meal: 'Lunch',
  name: 'Chicken, rice & broccoli',
  calories: 780,
  protein: 60,
  carbs: 95,
  fat: 15,
}
const body: BodyEntry = {
  id: 'b-1',
  date: '2026-11-08',
  weight: 84.5,
  bodyFat: 14,
  chest: 108,
  waist: 82,
  arms: 40,
  thighs: 62,
}
const health: HealthEntry = {
  id: 'h-1',
  date: '2026-11-08',
  sleepHours: 7.5,
  waterL: 3.5,
  restingHR: 55,
  steps: 9000,
  energy: 4,
  notes: 'Good day',
}
const goals: Goals = {
  unit: 'kg',
  calories: 2800,
  protein: 200,
  carbs: 320,
  fat: 80,
  targetWeight: 85,
  waterL: 4,
  sleepHours: 8,
}
const appData: AppData = {
  version: 1,
  workouts: [workout],
  foods: [food],
  body: [body],
  health: [health],
  goals,
}

describe('ISODateSchema', () => {
  it.each(['2026-11-08', '2024-02-29', '2000-02-29', '1999-12-31', '2026-01-01'])(
    'accepts the real date %s',
    (date) => {
      expect(ISODateSchema.safeParse(date).success).toBe(true)
    },
  )

  it.each([
    ['impossible day', '2026-02-30'],
    ['non-leap Feb 29', '2026-02-29'],
    ['century non-leap Feb 29', '1900-02-29'],
    ['month 13', '2026-13-01'],
    ['month 00', '2026-00-10'],
    ['day 00', '2026-01-00'],
    ['day 32', '2026-01-32'],
    ['wrong separator', '2026/11/08'],
    ['missing zero padding', '2026-1-8'],
    ['timestamp', '2026-11-08T10:00:00Z'],
    ['empty string', ''],
    ['surrounding spaces', ' 2026-11-08 '],
  ])('rejects %s (%s)', (_label, date) => {
    expect(ISODateSchema.safeParse(date).success).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(ISODateSchema.safeParse(20261108).success).toBe(false)
    expect(isRealISODate('not-a-date')).toBe(false)
  })
})

describe('SetEntrySchema', () => {
  it('accepts a valid set, including the 0 and max bounds', () => {
    expect(SetEntrySchema.parse(set)).toEqual(set)
    expect(SetEntrySchema.safeParse({ reps: 0, weight: 0 }).success).toBe(true)
    expect(SetEntrySchema.safeParse({ reps: 1000, weight: 2000 }).success).toBe(true)
  })

  it.each([
    ['negative reps', { reps: -1, weight: 100 }],
    ['fractional reps', { reps: 8.5, weight: 100 }],
    ['reps above 1000', { reps: 1001, weight: 100 }],
    ['negative weight', { reps: 8, weight: -0.5 }],
    ['weight above 2000', { reps: 8, weight: 2000.5 }],
    ['non-finite weight', { reps: 8, weight: Number.POSITIVE_INFINITY }],
    ['NaN reps', { reps: Number.NaN, weight: 100 }],
    ['string weight', { reps: 8, weight: '100' }],
    ['missing reps', { weight: 100 }],
  ])('rejects a set with %s', (_label, value) => {
    expect(SetEntrySchema.safeParse(value).success).toBe(false)
  })
})

describe('ExerciseEntrySchema', () => {
  it('accepts a valid exercise and trims its name', () => {
    const parsed = ExerciseEntrySchema.parse({ ...exercise, name: '  Bench Press  ' })
    expect(parsed.name).toBe('Bench Press')
  })

  it('accepts a name of exactly the max length', () => {
    expect(ExerciseEntrySchema.safeParse({ ...exercise, name: 'a'.repeat(NAME_MAX) }).success).toBe(
      true,
    )
  })

  it.each([
    ['empty name', { ...exercise, name: '' }],
    ['whitespace-only name', { ...exercise, name: '   ' }],
    ['name over 100 chars', { ...exercise, name: 'a'.repeat(NAME_MAX + 1) }],
    ['empty id', { ...exercise, id: '' }],
    ['a NUL character in the name', { ...exercise, name: 'Bench\u0000Press' }],
    ['a NUL character in the id', { ...exercise, id: 'e\u00001' }],
    ['empty muscle', { ...exercise, muscle: '' }],
    ['an invalid set', { ...exercise, sets: [{ reps: -1, weight: 0 }] }],
    ['sets not an array', { ...exercise, sets: set }],
  ])('rejects an exercise with %s', (_label, value) => {
    expect(ExerciseEntrySchema.safeParse(value).success).toBe(false)
  })
})

describe('WorkoutSchema', () => {
  it('accepts a full workout and one without optional fields', () => {
    expect(WorkoutSchema.parse(workout)).toEqual(workout)
    const minimal = { id: 'w-2', date: '2026-11-07', name: 'Legs', exercises: [] }
    expect(WorkoutSchema.safeParse(minimal).success).toBe(true)
  })

  it('trims notes and accepts notes of exactly the max length', () => {
    expect(WorkoutSchema.parse({ ...workout, notes: '  ok  ' }).notes).toBe('ok')
    expect(WorkoutSchema.safeParse({ ...workout, notes: 'n'.repeat(NOTES_MAX) }).success).toBe(true)
  })

  it.each([
    ['notes over 2000 chars', { ...workout, notes: 'n'.repeat(NOTES_MAX + 1) }],
    ['a NUL character in the notes', { ...workout, notes: 'felt\u0000good' }],
    ['invalid date', { ...workout, date: '2026-02-30' }],
    ['negative duration', { ...workout, durationMin: -5 }],
    ['empty name', { ...workout, name: ' ' }],
    ['an invalid exercise', { ...workout, exercises: [{ ...exercise, name: '' }] }],
    ['missing exercises', { ...workout, exercises: undefined }],
  ])('rejects a workout with %s', (_label, value) => {
    expect(WorkoutSchema.safeParse(value).success).toBe(false)
  })
})

describe('MealSchema', () => {
  it.each(MEALS)('accepts the meal %s', (meal) => {
    expect(MealSchema.parse(meal)).toBe(meal)
  })

  it('rejects an unknown meal', () => {
    expect(MealSchema.safeParse('Brunch').success).toBe(false)
    expect(MealSchema.safeParse('breakfast').success).toBe(false)
  })
})

describe('FoodEntrySchema', () => {
  it('accepts a valid food entry, including zero macros', () => {
    expect(FoodEntrySchema.parse(food)).toEqual(food)
    const zero = { ...food, calories: 0, protein: 0, carbs: 0, fat: 0 }
    expect(FoodEntrySchema.safeParse(zero).success).toBe(true)
    const max = { ...food, calories: 20000, protein: 2000, carbs: 2000, fat: 2000 }
    expect(FoodEntrySchema.safeParse(max).success).toBe(true)
  })

  it.each([
    ['negative calories', { ...food, calories: -1 }],
    ['negative protein', { ...food, protein: -1 }],
    ['negative carbs', { ...food, carbs: -1 }],
    ['negative fat', { ...food, fat: -1 }],
    ['calories above 20000', { ...food, calories: 20001 }],
    ['protein above 2000', { ...food, protein: 2001 }],
    ['carbs above 2000', { ...food, carbs: 2001 }],
    ['fat above 2000', { ...food, fat: 2001 }],
    ['unknown meal', { ...food, meal: 'Brunch' }],
    ['empty name', { ...food, name: '' }],
    ['name over 100 chars', { ...food, name: 'x'.repeat(NAME_MAX + 1) }],
    ['invalid date', { ...food, date: '2026-11-31' }],
  ])('rejects a food entry with %s', (_label, value) => {
    expect(FoodEntrySchema.safeParse(value).success).toBe(false)
  })
})

describe('BodyEntrySchema', () => {
  it('accepts a full body entry and one with only weight', () => {
    expect(BodyEntrySchema.parse(body)).toEqual(body)
    expect(BodyEntrySchema.safeParse({ id: 'b-2', date: '2026-11-07', weight: 85 }).success).toBe(
      true,
    )
  })

  it.each([
    ['negative weight', { ...body, weight: -1 }],
    ['weight above 2000', { ...body, weight: 2001 }],
    ['missing weight', { ...body, weight: undefined }],
    ['body fat above 100', { ...body, bodyFat: 101 }],
    ['negative body fat', { ...body, bodyFat: -1 }],
    ['negative chest', { ...body, chest: -1 }],
    ['negative waist', { ...body, waist: -1 }],
    ['negative arms', { ...body, arms: -1 }],
    ['negative thighs', { ...body, thighs: -1 }],
    ['chest above 1000', { ...body, chest: 1001 }],
    ['waist above 1000', { ...body, waist: 1001 }],
    ['arms above 1000', { ...body, arms: 1001 }],
    ['thighs above 1000', { ...body, thighs: 1001 }],
    ['invalid date', { ...body, date: 'yesterday' }],
  ])('rejects a body entry with %s', (_label, value) => {
    expect(BodyEntrySchema.safeParse(value).success).toBe(false)
  })
})

describe('HealthEntrySchema', () => {
  it('accepts a full health entry and one with only id and date', () => {
    expect(HealthEntrySchema.parse(health)).toEqual(health)
    expect(HealthEntrySchema.safeParse({ id: 'h-2', date: '2026-11-07' }).success).toBe(true)
  })

  it('accepts water, resting HR and steps at their max', () => {
    const max = { ...health, waterL: 20, restingHR: 300, steps: 200000 }
    expect(HealthEntrySchema.safeParse(max).success).toBe(true)
  })

  it.each([1, 5])('accepts energy %i', (energy) => {
    expect(HealthEntrySchema.safeParse({ ...health, energy }).success).toBe(true)
  })

  it.each([
    ['energy 0', { ...health, energy: 0 }],
    ['energy 6', { ...health, energy: 6 }],
    ['fractional energy', { ...health, energy: 3.5 }],
    ['sleep above 24 hours', { ...health, sleepHours: 25 }],
    ['negative sleep', { ...health, sleepHours: -1 }],
    ['negative water', { ...health, waterL: -0.1 }],
    ['negative resting HR', { ...health, restingHR: -1 }],
    ['fractional steps', { ...health, steps: 10.5 }],
    ['negative steps', { ...health, steps: -1 }],
    ['water above 20 L', { ...health, waterL: 20.1 }],
    ['resting HR above 300', { ...health, restingHR: 301 }],
    ['steps above 200000', { ...health, steps: 200001 }],
    ['notes over 2000 chars', { ...health, notes: 'n'.repeat(NOTES_MAX + 1) }],
    ['invalid date', { ...health, date: '2026-04-31' }],
  ])('rejects a health entry with %s', (_label, value) => {
    expect(HealthEntrySchema.safeParse(value).success).toBe(false)
  })
})

describe('GoalsSchema', () => {
  it('accepts valid goals in both units', () => {
    expect(GoalsSchema.parse(goals)).toEqual(goals)
    expect(GoalsSchema.safeParse({ ...goals, unit: 'lb' }).success).toBe(true)
  })

  it('accepts calories, macros and water at their max', () => {
    const max = { ...goals, calories: 20000, protein: 2000, carbs: 2000, fat: 2000, waterL: 20 }
    expect(GoalsSchema.safeParse(max).success).toBe(true)
  })

  it('UnitSchema only allows kg and lb', () => {
    expect(UnitSchema.options).toEqual(['kg', 'lb'])
  })

  it.each([
    ['unknown unit', { ...goals, unit: 'stone' }],
    ['negative calories', { ...goals, calories: -1 }],
    ['negative protein', { ...goals, protein: -1 }],
    ['negative carbs', { ...goals, carbs: -1 }],
    ['negative fat', { ...goals, fat: -1 }],
    ['negative target weight', { ...goals, targetWeight: -1 }],
    ['target weight above 2000', { ...goals, targetWeight: 2001 }],
    ['negative water', { ...goals, waterL: -1 }],
    ['calories above 20000', { ...goals, calories: 20001 }],
    ['protein above 2000', { ...goals, protein: 2001 }],
    ['carbs above 2000', { ...goals, carbs: 2001 }],
    ['fat above 2000', { ...goals, fat: 2001 }],
    ['water above 20 L', { ...goals, waterL: 20.1 }],
    ['sleep above 24 hours', { ...goals, sleepHours: 25 }],
    ['missing field', { ...goals, calories: undefined }],
  ])('rejects goals with %s', (_label, value) => {
    expect(GoalsSchema.safeParse(value).success).toBe(false)
  })
})

describe('AppDataSchema', () => {
  it('accepts a complete backup and an empty one', () => {
    expect(AppDataSchema.parse(appData)).toEqual(appData)
    const empty = { version: 1, workouts: [], foods: [], body: [], health: [], goals }
    expect(AppDataSchema.safeParse(empty).success).toBe(true)
  })

  it.each([
    ['an unsupported version', { ...appData, version: 2 }],
    ['an invalid nested workout', { ...appData, workouts: [{ ...workout, date: '2026-02-30' }] }],
    ['an invalid nested food', { ...appData, foods: [{ ...food, calories: -1 }] }],
    ['an invalid nested body entry', { ...appData, body: [{ ...body, weight: -1 }] }],
    ['an invalid nested health entry', { ...appData, health: [{ ...health, energy: 9 }] }],
    ['invalid goals', { ...appData, goals: { ...goals, unit: 'st' } }],
    ['a missing collection', { ...appData, foods: undefined }],
    ['a non-object value', 'not json'],
  ])('rejects a backup with %s', (_label, value) => {
    expect(AppDataSchema.safeParse(value).success).toBe(false)
  })
})

describe('auth schemas', () => {
  const credentials = { email: ' Lifter@Example.COM ', password: 'long enough' }

  it('normalises the email on login and register', () => {
    const expected = { email: 'lifter@example.com', password: 'long enough' }
    expect(LoginSchema.parse(credentials)).toEqual(expected)
    expect(RegisterSchema.parse(credentials)).toEqual(expected)
  })

  it.each([
    [
      'an invalid email',
      LoginSchema,
      { ...credentials, email: 'nope' },
      'Enter a valid email address',
    ],
    [
      'a too long email',
      LoginSchema,
      { ...credentials, email: `${'a'.repeat(250)}@x.io` },
      'Email is too long',
    ],
    ['an empty password', LoginSchema, { ...credentials, password: '' }, 'Enter your password'],
    [
      'a too long password',
      LoginSchema,
      { ...credentials, password: 'a'.repeat(129) },
      'Password must be at most 128 characters',
    ],
    [
      'a short register password',
      RegisterSchema,
      { ...credentials, password: 'short' },
      'Password must be at least 10 characters',
    ],
    ['an empty delete password', DeleteAccountSchema, { password: '' }, 'Enter your password'],
  ])('rejects %s with a readable message', (_label, schema, value, message) => {
    const result = schema.safeParse(value)
    expect(result.error?.issues[0].message).toBe(message)
  })

  it('parses the public user', () => {
    const user = { id: '3f0c1a52-8d4e-4b7a-9c1e-2a6b5d7e8f90', email: 'lifter@example.com' }
    expect(UserSchema.parse(user)).toEqual(user)
    expect(UserSchema.safeParse({ ...user, id: 'nope' }).success).toBe(false)
  })
})

describe('constants', () => {
  it('exposes the four meals in display order', () => {
    expect(MEALS).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snack'])
  })

  it('exposes the twelve muscle groups', () => {
    expect(MUSCLES).toHaveLength(12)
    expect(MUSCLES).toContain('Full body')
  })
})
