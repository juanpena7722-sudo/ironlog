export type ISODate = string // yyyy-mm-dd

export interface SetEntry {
  reps: number
  weight: number
}

export interface ExerciseEntry {
  id: string
  name: string
  muscle: string
  sets: SetEntry[]
}

export interface Workout {
  id: string
  date: ISODate
  name: string
  durationMin?: number
  notes?: string
  exercises: ExerciseEntry[]
}

export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const
export type Meal = (typeof MEALS)[number]

export interface FoodEntry {
  id: string
  date: ISODate
  meal: Meal
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface BodyEntry {
  id: string
  date: ISODate
  weight: number
  bodyFat?: number
  chest?: number
  waist?: number
  arms?: number
  thighs?: number
}

export interface HealthEntry {
  id: string
  date: ISODate
  sleepHours?: number
  waterL?: number
  restingHR?: number
  steps?: number
  energy?: number // 1-5
  notes?: string
}

export interface Goals {
  unit: 'kg' | 'lb'
  calories: number
  protein: number
  carbs: number
  fat: number
  targetWeight: number
  waterL: number
  sleepHours: number
}

export interface AppData {
  version: 1
  workouts: Workout[]
  foods: FoodEntry[]
  body: BodyEntry[]
  health: HealthEntry[]
  goals: Goals
}

export const MUSCLES = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Abs',
  'Forearms',
  'Full body',
] as const
