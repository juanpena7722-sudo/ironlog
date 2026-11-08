import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance, InjectOptions } from 'fastify'
import { WorkoutSchema } from '../../shared/schemas.js'
import { buildApp } from './app.js'
import { TEST_ENV, truncateTables } from './test/db.js'

const WORKOUTS_URL = '/api/v1/workouts'
const MISSING_ID = '00000000-0000-4000-8000-000000000000'
const WORKOUT = {
  date: '2026-03-10',
  name: 'Push',
  durationMin: 60,
  notes: 'Felt strong',
  exercises: [
    {
      name: 'Bench Press',
      muscle: 'Chest',
      sets: [
        { reps: 5, weight: 100.5 },
        { reps: 3, weight: 110 },
      ],
    },
    { name: 'Dips', muscle: 'Triceps', sets: [{ reps: 12, weight: 0 }] },
  ],
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

async function create(payload: object = WORKOUT, cookie = session) {
  const response = await send({ method: 'POST', url: WORKOUTS_URL, payload }, cookie)
  expect(response.statusCode).toBe(201)
  return WorkoutSchema.parse(response.json())
}

function expectProblem(response: Awaited<ReturnType<typeof send>>, status: number) {
  expect(response.statusCode).toBe(status)
  expect(response.headers['content-type']).toMatch(/^application\/problem\+json/)
  expect(response.json()).toMatchObject({ type: 'about:blank', status })
}

describe('POST /workouts', () => {
  it('creates a workout with nested exercises and sets in order', async () => {
    const workout = await create()
    expect(workout).toEqual({ ...WORKOUT, id: expect.any(String), exercises: expect.any(Array) })
    expect(workout.exercises.map(({ name, muscle, sets }) => ({ name, muscle, sets }))).toEqual(
      WORKOUT.exercises,
    )
    expect(workout.exercises.every((exercise) => typeof exercise.id === 'string')).toBe(true)
  })

  it('omits empty optional fields from the response', async () => {
    const response = await send({
      method: 'POST',
      url: WORKOUTS_URL,
      payload: { date: '2026-03-10', name: 'Rest', exercises: [] },
    })
    expect(response.json()).toEqual({
      id: expect.any(String),
      date: '2026-03-10',
      name: 'Rest',
      exercises: [],
    })
  })

  it('returns 400 for an invalid body', async () => {
    const response = await send({
      method: 'POST',
      url: WORKOUTS_URL,
      payload: { ...WORKOUT, date: '2026-02-30', exercises: [{ name: '', sets: [] }] },
    })
    expectProblem(response, 400)
    const paths = response.json().errors.map((error: { path: string }) => error.path)
    expect(paths).toEqual(
      expect.arrayContaining(['date', 'exercises.0.name', 'exercises.0.muscle']),
    )
  })

  it('returns 401 without a session', async () => {
    expectProblem(await send({ method: 'POST', url: WORKOUTS_URL, payload: WORKOUT }, null), 401)
  })
})

describe('GET /workouts', () => {
  it('filters by an inclusive date range, newest first', async () => {
    for (const date of ['2026-03-01', '2026-03-05', '2026-03-10', '2026-03-15']) {
      await create({ ...WORKOUT, date, name: date })
    }
    const response = await send({
      method: 'GET',
      url: `${WORKOUTS_URL}?from=2026-03-05&to=2026-03-10`,
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().map((workout: { date: string }) => workout.date)).toEqual([
      '2026-03-10',
      '2026-03-05',
    ])
  })

  it('defaults to the last 90 days', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-06-30T12:00:00Z'))
    for (const date of ['2026-03-31', '2026-04-01', '2026-06-30']) {
      await create({ ...WORKOUT, date })
    }
    const response = await send({ method: 'GET', url: WORKOUTS_URL })
    expect(response.json().map((workout: { date: string }) => workout.date)).toEqual([
      '2026-06-30',
      '2026-04-01',
    ])
  })

  it('returns 400 for an invalid date filter', async () => {
    expectProblem(await send({ method: 'GET', url: `${WORKOUTS_URL}?from=2026-13-01` }), 400)
  })

  it('returns 401 without a session', async () => {
    expectProblem(await send({ method: 'GET', url: WORKOUTS_URL }, null), 401)
  })

  it("excludes another user's workouts", async () => {
    await create(WORKOUT, await createSession('other@example.com'))
    const response = await send({ method: 'GET', url: `${WORKOUTS_URL}?from=2026-01-01` })
    expect(response.json()).toEqual([])
  })
})

describe('GET /workouts/:id', () => {
  it('returns the workout', async () => {
    const workout = await create()
    const response = await send({ method: 'GET', url: `${WORKOUTS_URL}/${workout.id}` })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(workout)
  })

  it('returns 404 for an unknown id', async () => {
    expectProblem(await send({ method: 'GET', url: `${WORKOUTS_URL}/${MISSING_ID}` }), 404)
  })

  it('returns 400 for a malformed id', async () => {
    expectProblem(await send({ method: 'GET', url: `${WORKOUTS_URL}/not-a-uuid` }), 400)
  })

  it('returns 401 without a session', async () => {
    expectProblem(await send({ method: 'GET', url: `${WORKOUTS_URL}/${MISSING_ID}` }, null), 401)
  })

  it("returns 404 for another user's workout", async () => {
    const workout = await create(WORKOUT, await createSession('other@example.com'))
    expectProblem(await send({ method: 'GET', url: `${WORKOUTS_URL}/${workout.id}` }), 404)
  })
})

describe('PUT /workouts/:id', () => {
  it('replaces the workout and removes dropped exercises', async () => {
    const workout = await create()
    const replacement = {
      date: '2026-03-11',
      name: 'Push (light)',
      exercises: [{ name: 'Dips', muscle: 'Triceps', sets: [{ reps: 15, weight: 0 }] }],
    }
    const response = await send({
      method: 'PUT',
      url: `${WORKOUTS_URL}/${workout.id}`,
      payload: replacement,
    })
    expect(response.statusCode).toBe(200)
    const updated = WorkoutSchema.parse(response.json())
    expect(updated).toEqual({ ...replacement, id: workout.id, exercises: expect.any(Array) })
    expect(updated.exercises.map(({ name, muscle, sets }) => ({ name, muscle, sets }))).toEqual(
      replacement.exercises,
    )
    expect(await app.db.exercise.count()).toBe(1)
    expect(await app.db.workoutSet.count()).toBe(1)
    const fetched = await send({ method: 'GET', url: `${WORKOUTS_URL}/${workout.id}` })
    expect(fetched.json()).toEqual(updated)
  })

  it('returns 400 for an invalid body', async () => {
    const workout = await create()
    const response = await send({
      method: 'PUT',
      url: `${WORKOUTS_URL}/${workout.id}`,
      payload: { ...WORKOUT, exercises: [{ name: 'Row', muscle: 'Back', sets: [{ reps: 1.5 }] }] },
    })
    expectProblem(response, 400)
  })

  it('returns 404 for an unknown id', async () => {
    expectProblem(
      await send({ method: 'PUT', url: `${WORKOUTS_URL}/${MISSING_ID}`, payload: WORKOUT }),
      404,
    )
  })

  it('returns 401 without a session', async () => {
    const response = await send(
      { method: 'PUT', url: `${WORKOUTS_URL}/${MISSING_ID}`, payload: WORKOUT },
      null,
    )
    expectProblem(response, 401)
  })

  it("returns 404 for another user's workout and leaves it unchanged", async () => {
    const otherSession = await createSession('other@example.com')
    const workout = await create(WORKOUT, otherSession)
    const response = await send({
      method: 'PUT',
      url: `${WORKOUTS_URL}/${workout.id}`,
      payload: { ...WORKOUT, exercises: [] },
    })
    expectProblem(response, 404)
    const fetched = await send(
      { method: 'GET', url: `${WORKOUTS_URL}/${workout.id}` },
      otherSession,
    )
    expect(fetched.json()).toEqual(workout)
  })
})

describe('DELETE /workouts/:id', () => {
  it('deletes the workout with its exercises and sets', async () => {
    const workout = await create()
    const response = await send({ method: 'DELETE', url: `${WORKOUTS_URL}/${workout.id}` })
    expect(response.statusCode).toBe(204)
    expect(response.body).toBe('')
    expectProblem(await send({ method: 'GET', url: `${WORKOUTS_URL}/${workout.id}` }), 404)
    expect(await app.db.workoutSet.count()).toBe(0)
  })

  it('returns 404 for an unknown id', async () => {
    expectProblem(await send({ method: 'DELETE', url: `${WORKOUTS_URL}/${MISSING_ID}` }), 404)
  })

  it('returns 401 without a session', async () => {
    expectProblem(await send({ method: 'DELETE', url: `${WORKOUTS_URL}/${MISSING_ID}` }, null), 401)
  })

  it("returns 404 for another user's workout and keeps it", async () => {
    const otherSession = await createSession('other@example.com')
    const workout = await create(WORKOUT, otherSession)
    expectProblem(await send({ method: 'DELETE', url: `${WORKOUTS_URL}/${workout.id}` }), 404)
    const fetched = await send(
      { method: 'GET', url: `${WORKOUTS_URL}/${workout.id}` },
      otherSession,
    )
    expect(fetched.statusCode).toBe(200)
  })
})
