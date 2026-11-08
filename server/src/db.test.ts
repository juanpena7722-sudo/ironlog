import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import { TEST_ENV, truncateTables } from './test/db.js'

const app = buildApp(TEST_ENV)
const db = app.db
const DATE = new Date('2026-01-15')

let userId: string

async function createUser(email = 'lifter@example.com') {
  return db.user.create({ data: { email, passwordHash: 'hash' } })
}

beforeAll(() => truncateTables(db))
beforeEach(async () => {
  await truncateTables(db)
  userId = (await createUser()).id
})
afterAll(() => app.close())

async function createWorkout() {
  return db.workout.create({
    data: {
      userId,
      date: DATE,
      name: 'Push day',
      exercises: {
        create: [1, 0].map((position) => ({
          userId,
          position,
          name: `Exercise ${position}`,
          muscle: 'Chest',
          sets: {
            create: [
              { userId, position: 1, reps: 8, weight: 102.5 },
              { userId, position: 0, reps: 10, weight: 92.25 },
            ],
          },
        })),
      },
    },
  })
}

describe('database schema', () => {
  it('User CRUD with unique lowercase email', async () => {
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
    expect(user).toMatchObject({ email: 'lifter@example.com', passwordHash: 'hash' })
    expect(user.createdAt).toBeInstanceOf(Date)

    const updated = await db.user.update({ where: { id: userId }, data: { passwordHash: 'new' } })
    expect(updated.passwordHash).toBe('new')
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(user.updatedAt.getTime())

    await expect(createUser()).rejects.toMatchObject({ code: 'P2002' })
    await expect(createUser('Upper@Example.com')).rejects.toThrow()

    await db.user.delete({ where: { id: userId } })
    expect(await db.user.findUnique({ where: { id: userId } })).toBeNull()
  })

  it('Goals CRUD, one per user', async () => {
    const data = {
      unit: 'kg' as const,
      calories: 2800,
      protein: 200,
      carbs: 320,
      fat: 80,
      targetWeight: 85.5,
      waterL: 4,
      sleepHours: 8,
    }
    await db.goals.create({ data: { userId, ...data } })
    const goals = await db.goals.findUniqueOrThrow({ where: { userId } })
    expect(goals.targetWeight.toNumber()).toBe(85.5)
    await expect(db.goals.create({ data: { userId, ...data } })).rejects.toMatchObject({
      code: 'P2002',
    })

    const updated = await db.goals.update({ where: { userId }, data: { unit: 'lb' } })
    expect(updated.unit).toBe('lb')

    await db.goals.delete({ where: { userId } })
    expect(await db.goals.findUnique({ where: { userId } })).toBeNull()
  })

  it('Workout, Exercise and WorkoutSet CRUD with order preserved', async () => {
    const { id } = await createWorkout()
    const workout = await db.workout.findUniqueOrThrow({
      where: { id },
      include: {
        exercises: {
          orderBy: { position: 'asc' },
          include: { sets: { orderBy: { position: 'asc' } } },
        },
      },
    })
    expect(workout.date.toISOString().slice(0, 10)).toBe('2026-01-15')
    expect(workout.exercises.map((exercise) => exercise.name)).toEqual(['Exercise 0', 'Exercise 1'])
    expect(workout.exercises[0].sets.map((set) => [set.reps, set.weight.toNumber()])).toEqual([
      [10, 92.25],
      [8, 102.5],
    ])

    const exercise = workout.exercises[0]
    await db.exercise.update({ where: { id: exercise.id }, data: { muscle: 'Triceps' } })
    await db.workoutSet.update({ where: { id: exercise.sets[0].id }, data: { reps: 12 } })
    await db.workout.update({ where: { id }, data: { name: 'Pull day', notes: 'Felt strong' } })
    expect(await db.workout.findUniqueOrThrow({ where: { id } })).toMatchObject({
      name: 'Pull day',
      notes: 'Felt strong',
    })
    expect((await db.exercise.findUniqueOrThrow({ where: { id: exercise.id } })).muscle).toBe(
      'Triceps',
    )
    expect(
      (await db.workoutSet.findUniqueOrThrow({ where: { id: exercise.sets[0].id } })).reps,
    ).toBe(12)

    await db.workoutSet.delete({ where: { id: exercise.sets[0].id } })
    await db.exercise.delete({ where: { id: workout.exercises[1].id } })
    expect(await db.exercise.count()).toBe(1)
    expect(await db.workoutSet.count()).toBe(1)
  })

  it('FoodEntry CRUD', async () => {
    const { id } = await db.foodEntry.create({
      data: {
        userId,
        date: DATE,
        meal: 'Lunch',
        name: 'Chicken, rice & broccoli',
        calories: 780,
        protein: 60,
        carbs: 95,
        fat: 15,
      },
    })
    expect(await db.foodEntry.findUniqueOrThrow({ where: { id } })).toMatchObject({
      meal: 'Lunch',
      calories: 780,
    })
    const updated = await db.foodEntry.update({ where: { id }, data: { meal: 'Dinner' } })
    expect(updated.meal).toBe('Dinner')
    await db.foodEntry.delete({ where: { id } })
    expect(await db.foodEntry.count()).toBe(0)
  })

  it('BodyEntry CRUD with kg weight and cm lengths', async () => {
    const { id } = await db.bodyEntry.create({
      data: { userId, date: DATE, weight: 80.4, bodyFat: 13.2, waist: 82, arms: 39.5 },
    })
    const entry = await db.bodyEntry.findUniqueOrThrow({ where: { id } })
    expect(entry.weight.toNumber()).toBe(80.4)
    expect(entry.arms?.toNumber()).toBe(39.5)
    expect(entry.chest).toBeNull()
    const updated = await db.bodyEntry.update({ where: { id }, data: { weight: 81 } })
    expect(updated.weight.toNumber()).toBe(81)
    await db.bodyEntry.delete({ where: { id } })
    expect(await db.bodyEntry.count()).toBe(0)
  })

  it('HealthEntry CRUD', async () => {
    const { id } = await db.healthEntry.create({
      data: { userId, date: DATE, sleepHours: 7.5, steps: 9000, energy: 4 },
    })
    expect(await db.healthEntry.findUniqueOrThrow({ where: { id } })).toMatchObject({
      sleepHours: 7.5,
      steps: 9000,
      energy: 4,
      notes: null,
    })
    const updated = await db.healthEntry.update({ where: { id }, data: { notes: 'Rest day' } })
    expect(updated.notes).toBe('Rest day')
    await db.healthEntry.delete({ where: { id } })
    expect(await db.healthEntry.count()).toBe(0)
  })

  it('allows one health entry per user per day', async () => {
    await db.healthEntry.create({ data: { userId, date: DATE } })
    await expect(db.healthEntry.create({ data: { userId, date: DATE } })).rejects.toMatchObject({
      code: 'P2002',
    })
    const other = await createUser('other@example.com')
    await db.healthEntry.create({ data: { userId: other.id, date: DATE } })
    await db.healthEntry.create({ data: { userId, date: new Date('2026-01-16') } })
    expect(await db.healthEntry.count()).toBe(3)
  })

  it('deleting a workout cascades to its exercises and sets', async () => {
    const { id } = await createWorkout()
    expect(await db.workoutSet.count()).toBe(4)
    await db.workout.delete({ where: { id } })
    expect(await db.exercise.count()).toBe(0)
    expect(await db.workoutSet.count()).toBe(0)
  })

  it('deleting a user cascades to all of their data', async () => {
    await createWorkout()
    await db.goals.create({
      data: {
        userId,
        unit: 'kg',
        calories: 1,
        protein: 1,
        carbs: 1,
        fat: 1,
        targetWeight: 80,
        waterL: 1,
        sleepHours: 8,
      },
    })
    await db.foodEntry.create({
      data: {
        userId,
        date: DATE,
        meal: 'Snack',
        name: 'Shake',
        calories: 1,
        protein: 1,
        carbs: 1,
        fat: 1,
      },
    })
    await db.bodyEntry.create({ data: { userId, date: DATE, weight: 80 } })
    await db.healthEntry.create({ data: { userId, date: DATE } })

    await db.user.delete({ where: { id: userId } })

    const counts = await Promise.all([
      db.goals.count(),
      db.workout.count(),
      db.exercise.count(),
      db.workoutSet.count(),
      db.foodEntry.count(),
      db.bodyEntry.count(),
      db.healthEntry.count(),
    ])
    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})
