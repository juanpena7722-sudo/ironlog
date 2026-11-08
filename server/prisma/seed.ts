import { randomUUID } from 'node:crypto'
import { makeDemoData } from '../../src/demo.ts'
import { createDb } from '../src/db.ts'
import { parseEnv } from '../src/env.ts'

const DEMO_EMAIL = 'demo@ironlog.local'

const db = createDb(parseEnv(process.env).DATABASE_URL)
const { workouts, foods, body, health, goals } = makeDemoData()
const userId = randomUUID()

await db.$transaction(
  async (tx) => {
    await tx.user.deleteMany({ where: { email: DEMO_EMAIL } })
    // TB03 sets real passwords; this placeholder never verifies as an argon2 hash.
    await tx.user.create({ data: { id: userId, email: DEMO_EMAIL, passwordHash: '' } })
    await tx.goals.create({ data: { userId, ...goals } })
    for (const workout of workouts) {
      await tx.workout.create({
        data: {
          userId,
          date: new Date(workout.date),
          name: workout.name,
          durationMin: workout.durationMin,
          exercises: {
            create: workout.exercises.map((exercise, position) => ({
              userId,
              position,
              name: exercise.name,
              muscle: exercise.muscle,
              sets: {
                create: exercise.sets.map((set, setPosition) => ({
                  userId,
                  position: setPosition,
                  ...set,
                })),
              },
            })),
          },
        },
      })
    }
    await tx.foodEntry.createMany({
      data: foods.map((food) => ({ ...food, userId, id: undefined, date: new Date(food.date) })),
    })
    await tx.bodyEntry.createMany({
      data: body.map((entry) => ({ ...entry, userId, id: undefined, date: new Date(entry.date) })),
    })
    await tx.healthEntry.createMany({
      data: health.map((entry) => ({
        ...entry,
        userId,
        id: undefined,
        date: new Date(entry.date),
      })),
    })
  },
  { timeout: 60_000 },
)

await db.$disconnect()
