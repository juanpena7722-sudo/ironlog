import type { ExerciseEntry, FoodEntry, ISODate, Workout } from './types'

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

/** Local-time yyyy-mm-dd (toISOString would shift to UTC). */
export function toISO(d: Date): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const today = (): ISODate => toISO(new Date())

export function daysAgo(n: number): ISODate {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toISO(d)
}

export function lastNDays(n: number): ISODate[] {
  return Array.from({ length: n }, (_, i) => daysAgo(n - 1 - i))
}

export function fmtDate(iso: ISODate): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function fmtLongDate(iso: ISODate): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

/** Monday of the week containing iso. */
export function weekStart(iso: ISODate): ISODate {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - dow)
  return toISO(date)
}

/** Epley estimated one-rep max. */
export const e1rm = (weight: number, reps: number): number =>
  reps <= 0 ? 0 : reps === 1 ? weight : weight * (1 + reps / 30)

export const exerciseVolume = (ex: ExerciseEntry): number =>
  ex.sets.reduce((s, set) => s + set.reps * set.weight, 0)

export const workoutVolume = (w: Workout): number =>
  w.exercises.reduce((s, ex) => s + exerciseVolume(ex), 0)

export const round = (n: number, dp = 1): number => {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

export const num = (v: string): number | undefined => {
  if (v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export const byDateDesc = <T extends { date: ISODate }>(a: T, b: T) => b.date.localeCompare(a.date)
export const byDateAsc = <T extends { date: ISODate }>(a: T, b: T) => a.date.localeCompare(b.date)

export function totals(entries: FoodEntry[]) {
  return entries.reduce(
    (t, f) => ({
      calories: t.calories + f.calories,
      protein: t.protein + f.protein,
      carbs: t.carbs + f.carbs,
      fat: t.fat + f.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}
