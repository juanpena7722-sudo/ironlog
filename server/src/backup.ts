import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AppDataSchema, UnitSchema, type AppData } from '../../shared/schemas.js'
import { DEFAULT_GOALS } from './auth.js'
import { toBodyData, toBodyEntry } from './body.js'
import { toFoodData, toFoodEntry } from './foods.js'
import { Prisma } from './generated/prisma/client.js'
import { toGoals } from './goals.js'
import { toHealthData, toHealthEntry } from './health.js'
import { toISODate } from './routes.js'
import { WORKOUT_INCLUDE, toWorkout } from './workouts.js'

const IMPORT_BODY_LIMIT = 5 * 1024 * 1024
const IMPORT_TIMEOUT_MS = 120_000
const LB_PER_KG = 2.20462
const CM_PER_INCH = 2.54
const MEASUREMENT_FIELDS = ['chest', 'waist', 'arms', 'thighs']
const OWNER_SELECT = { id: true, userId: true } as const

const IMPORT_QUERY_SCHEMA = z.object({
  mode: z.enum(['merge', 'replace']),
  unitHint: UnitSchema.default('kg'),
})

type ImportMode = z.infer<typeof IMPORT_QUERY_SCHEMA>['mode']
type IdOwner = { id: string; userId: string }
type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mapObjects(value: unknown, map: (record: JsonObject) => JsonObject): unknown {
  return Array.isArray(value) ? value.map((item) => (isObject(item) ? map(item) : item)) : value
}

function convertFields(record: JsonObject, fields: string[], convert: (value: number) => number) {
  const copy = { ...record }
  for (const field of fields) {
    const value = copy[field]
    if (typeof value === 'number') copy[field] = Math.round(convert(value) * 100) / 100
  }
  return copy
}

// Converts before validation so the shared kg/cm limits apply to the converted values.
// Copies only the known weight paths so unknown, possibly deeply nested fields are never walked.
function convertFromLb(body: unknown): unknown {
  if (!isObject(body)) return body
  const toKg = (value: number) => value / LB_PER_KG
  const toCm = (value: number) => value * CM_PER_INCH
  return {
    ...body,
    workouts: mapObjects(body.workouts, (workout) => ({
      ...workout,
      exercises: mapObjects(workout.exercises, (exercise) => ({
        ...exercise,
        sets: mapObjects(exercise.sets, (set) => convertFields(set, ['weight'], toKg)),
      })),
    })),
    body: mapObjects(body.body, (entry) =>
      convertFields(convertFields(entry, ['weight'], toKg), MEASUREMENT_FIELDS, toCm),
    ),
    goals: isObject(body.goals) ? convertFields(body.goals, ['targetWeight'], toKg) : body.goals,
  }
}

function isUuid(id: string) {
  return z.uuid().safeParse(id).success
}

function uuidsOf(entries: { id: string }[]) {
  return entries.map((entry) => entry.id.toLowerCase()).filter(isUuid)
}

// Returns the id to insert, or null when this user already owns it.
function createIdResolver(userId: string, owners: IdOwner[]) {
  const ownerById = new Map(owners.map((owner) => [owner.id, owner.userId]))
  return (clientId: string): string | null => {
    const id = clientId.toLowerCase()
    const owner = ownerById.get(id)
    if (owner === userId) return null
    if (owner !== undefined || !isUuid(id)) return randomUUID()
    ownerById.set(id, userId)
    return id
  }
}

async function importData(
  tx: Prisma.TransactionClient,
  userId: string,
  data: AppData,
  mode: ImportMode,
) {
  const isReplace = mode === 'replace'
  if (isReplace) {
    await tx.workout.deleteMany({ where: { userId } })
    await tx.foodEntry.deleteMany({ where: { userId } })
    await tx.bodyEntry.deleteMany({ where: { userId } })
    await tx.healthEntry.deleteMany({ where: { userId } })
    await tx.goals.upsert({
      where: { userId },
      create: { userId, ...data.goals },
      update: data.goals,
    })
  }

  const exerciseEntries = data.workouts.flatMap((workout) => workout.exercises)
  const resolveWorkoutId = createIdResolver(
    userId,
    await tx.workout.findMany({
      where: { id: { in: uuidsOf(data.workouts) } },
      select: OWNER_SELECT,
    }),
  )
  const resolveExerciseId = createIdResolver(
    userId,
    await tx.exercise.findMany({
      where: { id: { in: uuidsOf(exerciseEntries) } },
      select: OWNER_SELECT,
    }),
  )
  const resolveFoodId = createIdResolver(
    userId,
    await tx.foodEntry.findMany({
      where: { id: { in: uuidsOf(data.foods) } },
      select: OWNER_SELECT,
    }),
  )
  const resolveBodyId = createIdResolver(
    userId,
    await tx.bodyEntry.findMany({
      where: { id: { in: uuidsOf(data.body) } },
      select: OWNER_SELECT,
    }),
  )
  const resolveHealthId = createIdResolver(
    userId,
    await tx.healthEntry.findMany({
      where: { id: { in: uuidsOf(data.health) } },
      select: OWNER_SELECT,
    }),
  )
  const healthDates = new Set(
    (await tx.healthEntry.findMany({ where: { userId }, select: { date: true } })).map((row) =>
      toISODate(row.date),
    ),
  )

  // Entries arrive newest first, so earlier entries get later timestamps to keep list order.
  const now = Date.now()
  const createdAt = (index: number) => new Date(now - index)

  const workouts: Prisma.WorkoutCreateManyInput[] = []
  const exercises: Prisma.ExerciseCreateManyInput[] = []
  const sets: Prisma.WorkoutSetCreateManyInput[] = []
  data.workouts.forEach((workout, index) => {
    const id = resolveWorkoutId(workout.id)
    if (!id) return
    workouts.push({
      id,
      userId,
      date: new Date(workout.date),
      name: workout.name,
      durationMin: workout.durationMin ?? null,
      notes: workout.notes ?? null,
      createdAt: createdAt(index),
    })
    workout.exercises.forEach((exercise, position) => {
      const exerciseId = resolveExerciseId(exercise.id) ?? randomUUID()
      exercises.push({
        id: exerciseId,
        userId,
        workoutId: id,
        position,
        name: exercise.name,
        muscle: exercise.muscle,
      })
      exercise.sets.forEach((set, setPosition) =>
        sets.push({
          userId,
          exerciseId,
          position: setPosition,
          reps: set.reps,
          weight: set.weight,
        }),
      )
    })
  })

  const foods = data.foods.flatMap(({ id: clientId, ...entry }, index) => {
    const id = resolveFoodId(clientId)
    return id ? [{ id, userId, createdAt: createdAt(index), ...toFoodData(entry) }] : []
  })

  const body = data.body.flatMap((entry, index) => {
    const id = resolveBodyId(entry.id)
    return id ? [{ id, userId, createdAt: createdAt(index), ...toBodyData(entry) }] : []
  })

  const health = data.health.flatMap((entry) => {
    if (healthDates.has(entry.date)) return []
    const id = resolveHealthId(entry.id)
    if (!id) return []
    healthDates.add(entry.date)
    return [{ id, userId, date: new Date(entry.date), ...toHealthData(entry) }]
  })

  await tx.workout.createMany({ data: workouts })
  await tx.exercise.createMany({ data: exercises })
  await tx.workoutSet.createMany({ data: sets })
  await tx.foodEntry.createMany({ data: foods })
  await tx.bodyEntry.createMany({ data: body })
  await tx.healthEntry.createMany({ data: health })

  return {
    imported: {
      workouts: workouts.length,
      foods: foods.length,
      body: body.length,
      health: health.length,
      goals: isReplace ? 1 : 0,
    },
    skipped: {
      workouts: data.workouts.length - workouts.length,
      foods: data.foods.length - foods.length,
      body: data.body.length - body.length,
      health: data.health.length - health.length,
      goals: isReplace ? 0 : 1,
    },
  }
}

export async function backupRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth)

  app.get('/', async (request, reply) => {
    const { userId } = request
    const [workouts, foods, body, health, goals] = await Promise.all([
      app.db.workout.findMany({
        where: { userId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: WORKOUT_INCLUDE,
      }),
      app.db.foodEntry.findMany({
        where: { userId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      app.db.bodyEntry.findMany({
        where: { userId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      app.db.healthEntry.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
      app.db.goals.findUnique({ where: { userId } }),
    ])
    const data: AppData = {
      version: 1,
      workouts: workouts.map(toWorkout),
      foods: foods.map(toFoodEntry),
      body: body.map(toBodyEntry),
      health: health.map(toHealthEntry),
      goals: goals ? toGoals(goals) : DEFAULT_GOALS,
    }
    const filename = `ironlog-backup-${toISODate(new Date())}.json`
    return reply.header('content-disposition', `attachment; filename="${filename}"`).send(data)
  })

  app.post('/import', { bodyLimit: IMPORT_BODY_LIMIT }, async (request) => {
    const { mode, unitHint } = IMPORT_QUERY_SCHEMA.parse(request.query)
    const data = AppDataSchema.parse(unitHint === 'lb' ? convertFromLb(request.body) : request.body)
    try {
      return await app.db.$transaction((tx) => importData(tx, request.userId, data, mode), {
        timeout: IMPORT_TIMEOUT_MS,
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw app.httpErrors.conflict('Import conflicted with concurrent changes; retry')
      }
      throw error
    }
  })
}
