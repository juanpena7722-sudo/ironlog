import { z } from 'zod'

export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const

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

export const NAME_MAX = 100
export const NOTES_MAX = 2000
const REPS_MAX = 1000
const WEIGHT_MAX = 2000
const MEASUREMENT_CM_MAX = 1000
const STEPS_MAX = 200000
const RESTING_HR_MAX = 300
const WATER_L_MAX = 20
const CALORIES_MAX = 20000
const MACRO_G_MAX = 2000

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function isRealISODate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value)
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  // Date.UTC rolls invalid days over (Feb 30 -> Mar 2), so a round-trip detects them.
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

/** Calendar day in local time, `yyyy-mm-dd`. */
export const ISODateSchema = z
  .string()
  .refine(isRealISODate, { message: 'Expected a real calendar date in yyyy-mm-dd format' })

// Postgres rejects NUL in text columns.
export const textSchema = z
  .string()
  .refine((value) => !value.includes('\u0000'), { message: 'Must not contain NUL characters' })

const idSchema = textSchema.min(1).max(NAME_MAX)
const nameSchema = textSchema.trim().min(1).max(NAME_MAX)
const notesSchema = textSchema.trim().max(NOTES_MAX)
const nonNegative = z.number().nonnegative()
const weightSchema = z.number().min(0).max(WEIGHT_MAX)
const measurementSchema = z.number().min(0).max(MEASUREMENT_CM_MAX)
const caloriesSchema = nonNegative.max(CALORIES_MAX)
const macroSchema = nonNegative.max(MACRO_G_MAX)
const waterSchema = nonNegative.max(WATER_L_MAX)

export const SetEntrySchema = z.object({
  reps: z.number().int().min(0).max(REPS_MAX),
  weight: weightSchema,
})

export const ExerciseEntrySchema = z.object({
  id: idSchema,
  name: nameSchema,
  muscle: nameSchema,
  sets: z.array(SetEntrySchema),
})

export const WorkoutSchema = z.object({
  id: idSchema,
  date: ISODateSchema,
  name: nameSchema,
  durationMin: nonNegative.optional(),
  notes: notesSchema.optional(),
  exercises: z.array(ExerciseEntrySchema),
})

export const MealSchema = z.enum(MEALS)

export const FoodEntrySchema = z.object({
  id: idSchema,
  date: ISODateSchema,
  meal: MealSchema,
  name: nameSchema,
  calories: caloriesSchema,
  protein: macroSchema,
  carbs: macroSchema,
  fat: macroSchema,
})

export const BodyEntrySchema = z.object({
  id: idSchema,
  date: ISODateSchema,
  weight: weightSchema,
  bodyFat: z.number().min(0).max(100).optional(),
  chest: measurementSchema.optional(),
  waist: measurementSchema.optional(),
  arms: measurementSchema.optional(),
  thighs: measurementSchema.optional(),
})

export const HealthEntrySchema = z.object({
  id: idSchema,
  date: ISODateSchema,
  sleepHours: z.number().min(0).max(24).optional(),
  waterL: waterSchema.optional(),
  restingHR: nonNegative.max(RESTING_HR_MAX).optional(),
  steps: z.number().int().nonnegative().max(STEPS_MAX).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  notes: notesSchema.optional(),
})

export const UnitSchema = z.enum(['kg', 'lb'])

export const GoalsSchema = z.object({
  unit: UnitSchema,
  calories: caloriesSchema,
  protein: macroSchema,
  carbs: macroSchema,
  fat: macroSchema,
  targetWeight: weightSchema,
  waterL: waterSchema,
  sleepHours: z.number().min(0).max(24),
})

const EMAIL_MAX = 254
const PASSWORD_MIN = 10
const PASSWORD_MAX = 128

const emailSchema = textSchema
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(EMAIL_MAX, 'Email is too long'))
const passwordSchema = textSchema
  .min(1, 'Enter your password')
  .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`)

export const LoginSchema = z.object({ email: emailSchema, password: passwordSchema })

export const RegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema.min(
    PASSWORD_MIN,
    `Password must be at least ${PASSWORD_MIN} characters`,
  ),
})

export const DeleteAccountSchema = z.object({ password: passwordSchema })

export const UserSchema = z.object({ id: z.uuid(), email: z.string() })

export const AppDataSchema = z.object({
  version: z.literal(1),
  workouts: z.array(WorkoutSchema),
  foods: z.array(FoodEntrySchema),
  body: z.array(BodyEntrySchema),
  health: z.array(HealthEntrySchema),
  goals: GoalsSchema,
})

export type ISODate = z.infer<typeof ISODateSchema>
export type SetEntry = z.infer<typeof SetEntrySchema>
export type ExerciseEntry = z.infer<typeof ExerciseEntrySchema>
export type Workout = z.infer<typeof WorkoutSchema>
export type Meal = z.infer<typeof MealSchema>
export type FoodEntry = z.infer<typeof FoodEntrySchema>
export type BodyEntry = z.infer<typeof BodyEntrySchema>
export type HealthEntry = z.infer<typeof HealthEntrySchema>
export type Goals = z.infer<typeof GoalsSchema>
export type AppData = z.infer<typeof AppDataSchema>
export type Credentials = z.infer<typeof LoginSchema>
export type User = z.infer<typeof UserSchema>
