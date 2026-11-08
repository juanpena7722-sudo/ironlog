import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ExerciseEntrySchema, WorkoutSchema, type Workout } from '../../shared/schemas.js'
import type { Prisma } from './generated/prisma/client.js'
import { ID_PARAMS_SCHEMA, parseDateRange, toISODate } from './routes.js'

const DEFAULT_RANGE_DAYS = 90

const WORKOUT_INPUT_SCHEMA = WorkoutSchema.omit({ id: true }).extend({
  exercises: z.array(ExerciseEntrySchema.omit({ id: true })),
})

const WORKOUT_INCLUDE = {
  exercises: {
    orderBy: { position: 'asc' },
    include: { sets: { orderBy: { position: 'asc' } } },
  },
} satisfies Prisma.WorkoutInclude

type WorkoutRow = Prisma.WorkoutGetPayload<{ include: typeof WORKOUT_INCLUDE }>
type WorkoutInput = z.infer<typeof WORKOUT_INPUT_SCHEMA>

function toWorkout(row: WorkoutRow): Workout {
  return {
    id: row.id,
    date: toISODate(row.date),
    name: row.name,
    durationMin: row.durationMin ?? undefined,
    notes: row.notes ?? undefined,
    exercises: row.exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      muscle: exercise.muscle,
      sets: exercise.sets.map((set) => ({ reps: set.reps, weight: set.weight.toNumber() })),
    })),
  }
}

function toWorkoutData(userId: string, input: WorkoutInput) {
  return {
    date: new Date(input.date),
    name: input.name,
    durationMin: input.durationMin ?? null,
    notes: input.notes ?? null,
    exercises: {
      create: input.exercises.map((exercise, position) => ({
        userId,
        position,
        name: exercise.name,
        muscle: exercise.muscle,
        sets: {
          create: exercise.sets.map((set, setPosition) => ({
            userId,
            position: setPosition,
            reps: set.reps,
            weight: set.weight,
          })),
        },
      })),
    },
  }
}

export async function workoutRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth)

  function notFound() {
    return app.httpErrors.notFound('Workout not found')
  }

  app.get('/', async (request) => {
    const date = parseDateRange(request.query, DEFAULT_RANGE_DAYS)
    const rows = await app.db.workout.findMany({
      where: { userId: request.userId, date },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: WORKOUT_INCLUDE,
    })
    return rows.map(toWorkout)
  })

  app.get('/:id', async (request) => {
    const { id } = ID_PARAMS_SCHEMA.parse(request.params)
    const row = await app.db.workout.findFirst({
      where: { id, userId: request.userId },
      include: WORKOUT_INCLUDE,
    })
    if (!row) throw notFound()
    return toWorkout(row)
  })

  app.post('/', async (request, reply) => {
    const input = WORKOUT_INPUT_SCHEMA.parse(request.body)
    const row = await app.db.workout.create({
      data: { userId: request.userId, ...toWorkoutData(request.userId, input) },
      include: WORKOUT_INCLUDE,
    })
    return reply.status(201).send(toWorkout(row))
  })

  app.put('/:id', async (request) => {
    const { id } = ID_PARAMS_SCHEMA.parse(request.params)
    const input = WORKOUT_INPUT_SCHEMA.parse(request.body)
    const row = await app.db.$transaction(async (tx) => {
      const existing = await tx.workout.findFirst({
        where: { id, userId: request.userId },
        select: { id: true },
      })
      if (!existing) throw notFound()
      await tx.exercise.deleteMany({ where: { workoutId: id } })
      return tx.workout.update({
        where: { id },
        data: toWorkoutData(request.userId, input),
        include: WORKOUT_INCLUDE,
      })
    })
    return toWorkout(row)
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = ID_PARAMS_SCHEMA.parse(request.params)
    const { count } = await app.db.workout.deleteMany({ where: { id, userId: request.userId } })
    if (count === 0) throw notFound()
    return reply.status(204).send()
  })
}
