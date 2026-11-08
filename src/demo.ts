import type { AppData, BodyEntry, FoodEntry, HealthEntry, Workout } from './types'
import { DEFAULT_GOALS } from './store'
import { daysAgo, uid } from './utils'

const SPLIT: { name: string; exercises: [string, string, number][] }[] = [
  {
    name: 'Push',
    exercises: [
      ['Bench Press', 'Chest', 100],
      ['Overhead Press', 'Shoulders', 60],
      ['Incline DB Press', 'Chest', 36],
      ['Tricep Pushdown', 'Triceps', 35],
    ],
  },
  {
    name: 'Pull',
    exercises: [
      ['Deadlift', 'Back', 180],
      ['Barbell Row', 'Back', 90],
      ['Lat Pulldown', 'Back', 75],
      ['Barbell Curl', 'Biceps', 40],
    ],
  },
  {
    name: 'Legs',
    exercises: [
      ['Back Squat', 'Quads', 140],
      ['Romanian Deadlift', 'Hamstrings', 120],
      ['Leg Press', 'Quads', 250],
      ['Calf Raise', 'Calves', 100],
    ],
  },
]

const MEALS: Omit<FoodEntry, 'id' | 'date'>[] = [
  {
    meal: 'Breakfast',
    name: 'Oats + whey + banana',
    calories: 620,
    protein: 45,
    carbs: 90,
    fat: 10,
  },
  {
    meal: 'Lunch',
    name: 'Chicken, rice & broccoli',
    calories: 780,
    protein: 60,
    carbs: 95,
    fat: 15,
  },
  { meal: 'Snack', name: 'Greek yogurt + berries', calories: 280, protein: 25, carbs: 30, fat: 6 },
  {
    meal: 'Dinner',
    name: 'Salmon, potatoes & salad',
    calories: 820,
    protein: 50,
    carbs: 70,
    fat: 35,
  },
  { meal: 'Snack', name: 'Casein shake', calories: 240, protein: 40, carbs: 8, fat: 4 },
]

const jitter = (n: number, pct: number) => n * (1 + (Math.random() * 2 - 1) * pct)

export function makeDemoData(): AppData {
  const workouts: Workout[] = []
  const foods: FoodEntry[] = []
  const body: BodyEntry[] = []
  const health: HealthEntry[] = []

  let session = 0
  for (let d = 59; d >= 0; d--) {
    const date = daysAgo(d)
    const progress = (59 - d) / 59

    // Train 5 days out of every 7.
    if (d % 7 !== 3 && d % 7 !== 6) {
      const day = SPLIT[session % SPLIT.length]
      session++
      workouts.push({
        id: uid(),
        date,
        name: `${day.name} day`,
        durationMin: Math.round(jitter(70, 0.15)),
        exercises: day.exercises.map(([name, muscle, base]) => {
          const w = Math.round((base * (1 + progress * 0.08)) / 2.5) * 2.5
          return {
            id: uid(),
            name,
            muscle,
            sets: [
              { weight: w, reps: 8 },
              { weight: w, reps: 8 },
              { weight: w, reps: 7 },
              { weight: w * 0.9, reps: 10 },
            ],
          }
        }),
      })
    }

    MEALS.forEach((m) => {
      if (Math.random() < 0.1) return
      foods.push({ ...m, id: uid(), date, calories: Math.round(jitter(m.calories, 0.1)) })
    })

    if (Math.random() < 0.85) {
      body.push({
        id: uid(),
        date,
        weight: Math.round((80 + progress * 2.4 + (Math.random() - 0.5) * 0.8) * 10) / 10,
        ...(d % 14 === 0
          ? {
              bodyFat: Math.round((13 + progress * 0.4) * 10) / 10,
              waist: 82,
              arms: Math.round((39 + progress * 0.8) * 10) / 10,
              chest: 108,
              thighs: 62,
            }
          : {}),
      })
    }

    health.push({
      id: uid(),
      date,
      sleepHours: Math.round(jitter(7.4, 0.12) * 4) / 4,
      waterL: Math.round(jitter(3.6, 0.15) * 4) / 4,
      restingHR: Math.round(jitter(56, 0.06)),
      steps: Math.round(jitter(9000, 0.3)),
      energy: 2 + Math.floor(Math.random() * 4),
    })
  }

  return { version: 1, workouts, foods, body, health, goals: { ...DEFAULT_GOALS } }
}
