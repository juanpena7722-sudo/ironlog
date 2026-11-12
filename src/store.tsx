import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import {
  BodyEntrySchema,
  FoodEntrySchema,
  GoalsSchema,
  HealthEntrySchema,
  WorkoutSchema,
} from '@shared/schemas'
import { apiRequest, jsonRequest } from './api/client'
import type { AppData, BodyEntry, FoodEntry, Goals, HealthEntry, ISODate, Workout } from './types'

export const DEFAULT_GOALS: Goals = {
  unit: 'kg',
  calories: 2800,
  protein: 200,
  carbs: 320,
  fat: 80,
  targetWeight: 85,
  waterL: 4,
  sleepHours: 8,
}

/** Fills in missing fields so older or hand-edited data still loads. */
export function normalize(input: Partial<AppData>): AppData {
  return {
    version: 1,
    workouts: Array.isArray(input.workouts) ? input.workouts : [],
    foods: Array.isArray(input.foods) ? input.foods : [],
    body: Array.isArray(input.body) ? input.body : [],
    health: Array.isArray(input.health) ? input.health : [],
    goals: { ...DEFAULT_GOALS, ...(input.goals ?? {}) },
  }
}

/** API exports are kg/cm; data from the browser-only version is in its display unit. */
export function unitHintFor(input: Partial<AppData>): Goals['unit'] {
  return input.canonicalUnit === 'kg' ? 'kg' : normalize(input).goals.unit
}

// List endpoints default to recent days only; pages need the whole history.
const ALL_TIME: ISODate = '1970-01-01'
const RECENT_FOODS_LIMIT = 12

type DateRange = { from: ISODate; to?: ISODate }
type Upsert<T> = { id?: string; entry: T }

function listQuery<T>(key: string, path: string, schema: z.ZodType<T>, { from, to }: DateRange) {
  const search = to ? `from=${from}&to=${to}` : `from=${from}`
  return {
    queryKey: [key, search],
    queryFn: () => apiRequest(`${path}?${search}`, z.array(schema)),
  }
}

export const useWorkouts = () =>
  useQuery(listQuery('workouts', '/workouts', WorkoutSchema, { from: ALL_TIME }))

export const useFoods = (range: DateRange = { from: ALL_TIME }) =>
  useQuery(listQuery('foods', '/foods', FoodEntrySchema, range))

export const useRecentFoods = () =>
  useQuery({
    queryKey: ['foods', 'recent'],
    queryFn: () =>
      apiRequest(`/foods/recent?limit=${RECENT_FOODS_LIMIT}`, z.array(FoodEntrySchema)),
  })

export const useBody = () =>
  useQuery(listQuery('body', '/body', BodyEntrySchema, { from: ALL_TIME }))

export const useHealth = () =>
  useQuery(listQuery('health', '/health-entries', HealthEntrySchema, { from: ALL_TIME }))

export const useGoals = () =>
  useQuery({ queryKey: ['goals'], queryFn: () => apiRequest('/goals', GoalsSchema) })

function useApiMutation<V>(key: string, mutationFn: (variables: V) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [key] }),
  })
}

function save<T>(path: string, schema: z.ZodType<T>, { id, entry }: Upsert<T>) {
  return id
    ? apiRequest(`${path}/${id}`, schema, jsonRequest('PUT', entry))
    : apiRequest(path, schema, jsonRequest('POST', entry))
}

const remove = (path: string) => apiRequest(path, z.undefined(), { method: 'DELETE' })

export const useSaveWorkout = () =>
  useApiMutation('workouts', (upsert: Upsert<Workout>) => save('/workouts', WorkoutSchema, upsert))

export const useDeleteWorkout = () =>
  useApiMutation('workouts', (id: string) => remove(`/workouts/${id}`))

export const useAddFood = () =>
  useApiMutation('foods', (entry: FoodEntry) => save('/foods', FoodEntrySchema, { entry }))

export const useDeleteFood = () => useApiMutation('foods', (id: string) => remove(`/foods/${id}`))

export const useSaveBody = () =>
  useApiMutation('body', (upsert: Upsert<BodyEntry>) => save('/body', BodyEntrySchema, upsert))

export const useDeleteBody = () => useApiMutation('body', (id: string) => remove(`/body/${id}`))

export const useSaveHealth = () =>
  useApiMutation('health', (entry: HealthEntry) =>
    apiRequest(`/health-entries/${entry.date}`, HealthEntrySchema, jsonRequest('PUT', entry)),
  )

export const useDeleteHealth = () =>
  useApiMutation('health', (date: ISODate) => remove(`/health-entries/${date}`))

export const useSaveGoals = () =>
  useApiMutation('goals', (goals: Goals) =>
    apiRequest('/goals', GoalsSchema, jsonRequest('PUT', goals)),
  )

type ImportRequest = { data: AppData; mode: 'merge' | 'replace'; unitHint?: Goals['unit'] }

export function useImportData() {
  const queryClient = useQueryClient()
  return useMutation({
    // The import summary is not shown, so its body is not parsed.
    mutationFn: ({ data, mode, unitHint = 'kg' }: ImportRequest) =>
      apiRequest(
        `/backup/import?mode=${mode}&unitHint=${unitHint}`,
        z.unknown(),
        jsonRequest('POST', data),
      ),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
