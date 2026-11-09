import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance, InjectOptions } from 'fastify'
import { AppDataSchema, type AppData } from '../../shared/schemas.js'
import { buildApp } from './app.js'
import { DEFAULT_GOALS } from './auth.js'
import type { Prisma } from './generated/prisma/client.js'
import { TEST_ENV, truncateTables } from './test/db.js'

const BACKUP_URL = '/api/v1/backup'
const IMPORT_URL = `${BACKUP_URL}/import`
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const BACKUP: AppData = {
  version: 1,
  workouts: [
    {
      id: 'w-legacy-1',
      date: '2026-03-10',
      name: 'Push',
      durationMin: 60,
      notes: 'Felt strong',
      exercises: [
        {
          id: 'e-legacy-1',
          name: 'Bench Press',
          muscle: 'Chest',
          sets: [
            { reps: 5, weight: 100.5 },
            { reps: 3, weight: 110 },
          ],
        },
        { id: 'e-legacy-2', name: 'Dips', muscle: 'Triceps', sets: [{ reps: 12, weight: 0 }] },
      ],
    },
    { id: 'w-legacy-2', date: '2026-03-10', name: 'Pull', exercises: [] },
    { id: 'w-legacy-3', date: '2026-03-08', name: 'Legs', exercises: [] },
  ],
  foods: [
    {
      id: 'f-legacy-1',
      date: '2026-03-10',
      meal: 'Dinner',
      name: 'Rice',
      calories: 400,
      protein: 8,
      carbs: 90,
      fat: 1,
    },
    {
      id: 'f-legacy-2',
      date: '2026-03-10',
      meal: 'Breakfast',
      name: 'Oats',
      calories: 300,
      protein: 10,
      carbs: 54,
      fat: 6,
    },
  ],
  body: [
    { id: 'b-legacy-1', date: '2026-03-10', weight: 82.5, bodyFat: 15, chest: 105, waist: 82 },
    { id: 'b-legacy-2', date: '2026-03-01', weight: 83 },
  ],
  health: [
    { id: 'h-legacy-1', date: '2026-03-10', sleepHours: 7.5, steps: 9000, energy: 4 },
    { id: 'h-legacy-2', date: '2026-03-09', waterL: 3, notes: 'Tired' },
  ],
  goals: { ...DEFAULT_GOALS, unit: 'lb', calories: 2500, targetWeight: 80 },
}

let app: FastifyInstance
let session: string

beforeEach(async () => {
  app = buildApp(TEST_ENV)
  await app.ready()
  await truncateTables(app.db)
  session = await createSession('lifter@example.com')
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  await app.close()
})

async function createSession(email: string) {
  const user = await app.db.user.create({ data: { email, passwordHash: '' } })
  return app.jwt.sign({ sub: user.id })
}

function send(options: InjectOptions, cookie: string | null = session) {
  return app.inject({ ...options, cookies: cookie === null ? {} : { session: cookie } })
}

function importBackup(payload: unknown, query: string, cookie = session) {
  return send(
    {
      method: 'POST',
      url: `${IMPORT_URL}?${query}`,
      payload: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    },
    cookie,
  )
}

async function exportBackup(cookie = session) {
  const response = await send({ method: 'GET', url: BACKUP_URL }, cookie)
  expect(response.statusCode).toBe(200)
  return AppDataSchema.parse(response.json())
}

function withoutIds(data: AppData) {
  const blankId = <T extends { id: string }>(entry: T) => ({ ...entry, id: '' })
  return {
    ...data,
    workouts: data.workouts.map((workout) => ({
      ...blankId(workout),
      exercises: workout.exercises.map(blankId),
    })),
    foods: data.foods.map(blankId),
    body: data.body.map(blankId),
    health: data.health.map(blankId),
  }
}

function expectProblem(response: Awaited<ReturnType<typeof send>>, status: number) {
  expect(response.statusCode).toBe(status)
  expect(response.headers['content-type']).toMatch(/^application\/problem\+json/)
  expect(response.json()).toMatchObject({ type: 'about:blank', status })
}

describe('GET /backup', () => {
  it('returns the data as an attachment named with the UTC date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-06-30T23:30:00-05:00'))
    expect((await importBackup(BACKUP, 'mode=replace')).statusCode).toBe(200)
    const response = await send({ method: 'GET', url: BACKUP_URL })
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="ironlog-backup-2026-07-01.json"',
    )
    expect(withoutIds(AppDataSchema.parse(response.json()))).toEqual(withoutIds(BACKUP))
  })

  it('returns empty collections and default goals for a user without data', async () => {
    expect(await exportBackup()).toEqual({
      version: 1,
      workouts: [],
      foods: [],
      body: [],
      health: [],
      goals: DEFAULT_GOALS,
    })
  })

  it('exports only the current user data', async () => {
    await importBackup(BACKUP, 'mode=replace')
    const other = await createSession('other@example.com')
    expect((await exportBackup(other)).workouts).toEqual([])
  })

  it('returns 401 without a session', async () => {
    expectProblem(await send({ method: 'GET', url: BACKUP_URL }, null), 401)
  })
})

describe('POST /backup/import', () => {
  it('round trips: export, import into a new user, export again gives the same data', async () => {
    await importBackup(BACKUP, 'mode=replace')
    const exported = await exportBackup()
    const other = await createSession('new@example.com')
    const response = await importBackup(exported, 'mode=replace', other)
    expect(response.statusCode).toBe(200)
    const reExported = await exportBackup(other)
    expect(withoutIds(reExported)).toEqual(withoutIds(exported))
    expect(reExported.workouts[0].id).not.toBe(exported.workouts[0].id)
  })

  it('keeps unused UUID ids and replaces legacy ids with UUIDs', async () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const backup = { ...BACKUP, foods: [{ ...BACKUP.foods[0], id }, BACKUP.foods[1]] }
    await importBackup(backup, 'mode=merge')
    const { foods, workouts } = await exportBackup()
    expect(foods[0].id).toBe(id)
    expect(foods[1].id).toMatch(UUID_PATTERN)
    expect(workouts[0].exercises[0].id).toMatch(UUID_PATTERN)
  })

  it('returns the imported and skipped counts', async () => {
    const response = await importBackup(BACKUP, 'mode=replace')
    expect(response.json()).toEqual({
      imported: { workouts: 3, foods: 2, body: 2, health: 2, goals: 1 },
      skipped: { workouts: 0, foods: 0, body: 0, health: 0, goals: 0 },
    })
  })

  it('merge skips entries the user already has and keeps the goals', async () => {
    await importBackup(BACKUP, 'mode=merge')
    const exported = await exportBackup()
    const extraFood = { ...BACKUP.foods[0], id: 'f-new', name: 'Beans' }
    const healthSameDate = { ...BACKUP.health[0], id: 'h-new', steps: 1 }
    const response = await importBackup(
      {
        ...exported,
        foods: [...exported.foods, extraFood],
        health: [...exported.health, healthSameDate],
        goals: BACKUP.goals,
      },
      'mode=merge',
    )
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      imported: { workouts: 0, foods: 1, body: 0, health: 0, goals: 0 },
      skipped: { workouts: 3, foods: 2, body: 2, health: 3, goals: 1 },
    })
    const merged = await exportBackup()
    expect(merged.foods).toHaveLength(3)
    expect(merged.health).toEqual(exported.health)
    expect(merged.goals).toEqual(DEFAULT_GOALS)
  })

  it('merge gives new ids to entries whose ids belong to another user', async () => {
    await importBackup(BACKUP, 'mode=merge')
    const exported = await exportBackup()
    const other = await createSession('other@example.com')
    const response = await importBackup(exported, 'mode=merge', other)
    expect(response.json().imported).toEqual({
      workouts: 3,
      foods: 2,
      body: 2,
      health: 2,
      goals: 0,
    })
    const otherData = await exportBackup(other)
    expect(otherData.foods[0].id).not.toBe(exported.foods[0].id)
    expect(withoutIds(otherData)).toEqual(withoutIds({ ...exported, goals: DEFAULT_GOALS }))
    expect(await exportBackup()).toEqual(exported)
  })

  it('replace swaps all data without touching other users', async () => {
    await importBackup(BACKUP, 'mode=replace')
    const other = await createSession('other@example.com')
    await importBackup(BACKUP, 'mode=replace', other)
    const otherBefore = await exportBackup(other)
    const replacement: AppData = {
      ...BACKUP,
      workouts: [BACKUP.workouts[2]],
      foods: [],
      body: [],
      health: [],
      goals: DEFAULT_GOALS,
    }
    const response = await importBackup(replacement, 'mode=replace')
    expect(response.statusCode).toBe(200)
    expect(withoutIds(await exportBackup())).toEqual(withoutIds(replacement))
    expect(await exportBackup(other)).toEqual(otherBefore)
  })

  it('replace is atomic: a failure leaves the data unchanged', async () => {
    await importBackup(BACKUP, 'mode=replace')
    const before = await exportBackup()
    const transaction = app.db.$transaction.bind(app.db)
    vi.spyOn(app.db, '$transaction').mockImplementation(((
      run: (tx: Prisma.TransactionClient) => Promise<unknown>,
      options?: { timeout?: number },
    ) =>
      transaction(async (tx) => {
        await run(tx)
        throw new Error('forced failure')
      }, options)) as unknown as typeof app.db.$transaction)
    const response = await importBackup({ ...BACKUP, workouts: [], foods: [] }, 'mode=replace')
    expectProblem(response, 500)
    vi.restoreAllMocks()
    expect(await exportBackup()).toEqual(before)
  })

  it('converts lb to kg and inches to cm, rounded to 2 decimals', async () => {
    const backup: AppData = {
      ...BACKUP,
      workouts: [
        {
          ...BACKUP.workouts[0],
          exercises: [
            { id: 'e1', name: 'Squat', muscle: 'Quads', sets: [{ reps: 5, weight: 225 }] },
          ],
        },
      ],
      body: [
        { id: 'b1', date: '2026-03-10', weight: 180, chest: 40, waist: 32.5, arms: 15, thighs: 24 },
      ],
      goals: { ...BACKUP.goals, targetWeight: 175 },
    }
    expect((await importBackup(backup, 'mode=replace&unitHint=lb')).statusCode).toBe(200)
    const data = await exportBackup()
    expect(data.workouts[0].exercises[0].sets).toEqual([{ reps: 5, weight: 102.06 }])
    expect(data.body).toEqual([
      {
        id: expect.any(String),
        date: '2026-03-10',
        weight: 81.65,
        chest: 101.6,
        waist: 82.55,
        arms: 38.1,
        thighs: 60.96,
      },
    ])
    expect(data.goals).toEqual({ ...BACKUP.goals, unit: 'lb', targetWeight: 79.38 })
  })

  it('applies the shared limits to the converted values', async () => {
    const heavy = { ...BACKUP, body: [{ id: 'b1', date: '2026-03-10', weight: 4000 }] }
    expect((await importBackup(heavy, 'mode=merge&unitHint=lb')).statusCode).toBe(200)
    expect((await exportBackup()).body[0].weight).toBe(1814.37)
    const wide = { ...BACKUP, body: [{ id: 'b2', date: '2026-03-11', weight: 80, chest: 500 }] }
    const response = await importBackup(wide, 'mode=merge&unitHint=lb')
    expectProblem(response, 400)
    expect(response.json().errors).toEqual([expect.objectContaining({ path: 'body.0.chest' })])
  })

  it('ignores deeply nested unknown fields with unitHint=lb', async () => {
    const pad = '['.repeat(10_000) + ']'.repeat(10_000)
    const payload = `${JSON.stringify(BACKUP).slice(0, -1)},"pad":${pad}}`
    const response = await send({
      method: 'POST',
      url: `${IMPORT_URL}?mode=merge&unitHint=lb`,
      payload,
      headers: { 'content-type': 'application/json' },
    })
    expect(response.statusCode).toBe(200)
    expect((await exportBackup()).body[0].weight).toBe(37.42)
  })

  it('does not convert with unitHint=kg', async () => {
    await importBackup(BACKUP, 'mode=replace&unitHint=kg')
    expect((await exportBackup()).body[0].weight).toBe(82.5)
  })

  it('returns 409 when an unused id is taken by another user during the import', async () => {
    const id = '22222222-2222-4222-8222-222222222222'
    const other = await app.db.user.create({
      data: { email: 'other@example.com', passwordHash: '' },
    })
    const transaction = app.db.$transaction.bind(app.db)
    vi.spyOn(app.db, '$transaction').mockImplementation(((
      run: (tx: Prisma.TransactionClient) => Promise<unknown>,
      options?: { timeout?: number },
    ) =>
      transaction(async (tx) => {
        const findMany = tx.foodEntry.findMany.bind(tx.foodEntry)
        vi.spyOn(tx.foodEntry, 'findMany').mockImplementation((async (
          args: Prisma.FoodEntryFindManyArgs,
        ) => {
          const owners = await findMany(args)
          await app.db.foodEntry.create({
            data: {
              ...BACKUP.foods[0],
              id,
              userId: other.id,
              date: new Date(BACKUP.foods[0].date),
            },
          })
          return owners
        }) as unknown as typeof tx.foodEntry.findMany)
        return run(tx)
      }, options)) as unknown as typeof app.db.$transaction)
    const backup = { ...BACKUP, foods: [{ ...BACKUP.foods[0], id }] }
    const response = await importBackup(backup, 'mode=merge')
    expectProblem(response, 409)
    expect(response.json().detail).toBe('Import conflicted with concurrent changes; retry')
    vi.restoreAllMocks()
    expect(await exportBackup()).toMatchObject({ workouts: [], foods: [] })
  })

  it('returns 400 for an invalid file', async () => {
    for (const payload of [{ ...BACKUP, version: 2 }, { version: 1 }, [], 'not a backup']) {
      expectProblem(await importBackup(payload, 'mode=merge'), 400)
    }
    expectProblem(
      await importBackup(
        { ...BACKUP, foods: [{ ...BACKUP.foods[0], calories: -1 }] },
        'mode=merge',
      ),
      400,
    )
    expect((await exportBackup()).workouts).toEqual([])
  })

  it('returns 400 for an invalid mode or unit hint', async () => {
    expectProblem(await importBackup(BACKUP, ''), 400)
    expectProblem(await importBackup(BACKUP, 'mode=overwrite'), 400)
    expectProblem(await importBackup(BACKUP, 'mode=merge&unitHint=st'), 400)
  })

  it('returns 413 for a body over 5 MB', async () => {
    const payload = { ...BACKUP, padding: 'x'.repeat(5 * 1024 * 1024) }
    expectProblem(await importBackup(payload, 'mode=merge'), 413)
  })

  it('returns 401 without a session', async () => {
    expectProblem(
      await send({ method: 'POST', url: `${IMPORT_URL}?mode=merge`, payload: BACKUP }, null),
      401,
    )
  })
})
