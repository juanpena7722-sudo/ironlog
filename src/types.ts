// Data shapes are defined once, as Zod schemas in shared/; this module re-exports them for the app.
export { MEALS, MUSCLES } from '@shared/schemas'
export type {
  AppData,
  BodyEntry,
  ExerciseEntry,
  FoodEntry,
  Goals,
  HealthEntry,
  ISODate,
  Meal,
  SetEntry,
  Workout,
} from '@shared/schemas'
