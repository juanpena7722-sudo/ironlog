import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppData, BodyEntry, FoodEntry, Goals, HealthEntry, Workout } from './types'

const STORAGE_KEY = 'ironlog:data'

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

const EMPTY: AppData = {
  version: 1,
  workouts: [],
  foods: [],
  body: [],
  health: [],
  goals: DEFAULT_GOALS,
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    return normalize(JSON.parse(raw))
  } catch {
    return EMPTY
  }
}

/** Fills in missing fields so older or hand-edited data still loads. */
function normalize(input: Partial<AppData>): AppData {
  return {
    version: 1,
    workouts: Array.isArray(input.workouts) ? input.workouts : [],
    foods: Array.isArray(input.foods) ? input.foods : [],
    body: Array.isArray(input.body) ? input.body : [],
    health: Array.isArray(input.health) ? input.health : [],
    goals: { ...DEFAULT_GOALS, ...(input.goals ?? {}) },
  }
}

type Collection = 'workouts' | 'foods' | 'body' | 'health'
type ItemOf<C extends Collection> = AppData[C][number]

interface Store {
  data: AppData
  upsert: <C extends Collection>(c: C, item: ItemOf<C>) => void
  remove: (c: Collection, id: string) => void
  setGoals: (g: Goals) => void
  replaceAll: (d: AppData) => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // storage full or unavailable; keep working in memory
    }
  }, [data])

  const store = useMemo<Store>(
    () => ({
      data,
      upsert: (c, item) =>
        setData((d) => {
          const list = d[c] as { id: string }[]
          const exists = list.some((x) => x.id === item.id)
          const next = exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]
          return { ...d, [c]: next }
        }),
      remove: (c, id) =>
        setData((d) => ({ ...d, [c]: (d[c] as { id: string }[]).filter((x) => x.id !== id) })),
      setGoals: (goals) => setData((d) => ({ ...d, goals })),
      replaceAll: (d) => setData(normalize(d)),
    }),
    [data],
  )

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}

export type { Workout, FoodEntry, BodyEntry, HealthEntry }
