import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance, InjectOptions } from 'fastify'
import { buildApp } from './app.js'
import { DEFAULT_GOALS } from './auth.js'
import { TEST_ENV, truncateTables } from './test/db.js'

const GOALS_URL = '/api/v1/goals'
const GOALS = {
  unit: 'lb',
  calories: 2500,
  protein: 180,
  carbs: 250,
  fat: 70,
  targetWeight: 82.55,
  waterL: 3.5,
  sleepHours: 7.5,
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
  await app.close()
})

async function createSession(email: string) {
  const user = await app.db.user.create({ data: { email, passwordHash: '' } })
  return app.jwt.sign({ sub: user.id })
}

function send(options: InjectOptions, cookie: string | null = session) {
  return app.inject({ ...options, cookies: cookie === null ? {} : { session: cookie } })
}

function expectProblem(response: Awaited<ReturnType<typeof send>>, status: number) {
  expect(response.statusCode).toBe(status)
  expect(response.headers['content-type']).toMatch(/^application\/problem\+json/)
  expect(response.json()).toMatchObject({ type: 'about:blank', status })
}

describe('GET /goals', () => {
  it('returns the defaults for a newly registered user', async () => {
    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'new@example.com', password: 'correct-horse-battery' },
    })
    expect(register.statusCode).toBe(201)
    const cookie = register.cookies.find((c) => c.name === 'session')?.value ?? ''
    const response = await send({ method: 'GET', url: GOALS_URL }, cookie)
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(DEFAULT_GOALS)
  })

  it('returns the defaults when the user has no goals row', async () => {
    const response = await send({ method: 'GET', url: GOALS_URL })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(DEFAULT_GOALS)
  })

  it('returns 401 without a session', async () => {
    expectProblem(await send({ method: 'GET', url: GOALS_URL }, null), 401)
  })
})

describe('PUT /goals', () => {
  it('upserts the goals and persists them', async () => {
    const response = await send({ method: 'PUT', url: GOALS_URL, payload: GOALS })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(GOALS)
    const updated = { ...GOALS, unit: 'kg', targetWeight: 80 }
    expect((await send({ method: 'PUT', url: GOALS_URL, payload: updated })).json()).toEqual(
      updated,
    )
    expect((await send({ method: 'GET', url: GOALS_URL })).json()).toEqual(updated)
  })

  it('keeps goals separate per user', async () => {
    await send({ method: 'PUT', url: GOALS_URL, payload: GOALS })
    const other = await createSession('other@example.com')
    expect((await send({ method: 'GET', url: GOALS_URL }, other)).json()).toEqual(DEFAULT_GOALS)
  })

  it('returns 400 for an invalid body', async () => {
    const response = await send({
      method: 'PUT',
      url: GOALS_URL,
      payload: { ...GOALS, unit: 'st', calories: -1, sleepHours: 25 },
    })
    expectProblem(response, 400)
    expect(response.json().errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'unit' }),
        expect.objectContaining({ path: 'calories' }),
        expect.objectContaining({ path: 'sleepHours' }),
      ]),
    )
  })

  it('returns 400 for a partial body', async () => {
    expectProblem(await send({ method: 'PUT', url: GOALS_URL, payload: { calories: 2000 } }), 400)
  })

  it('returns 401 without a session', async () => {
    expectProblem(await send({ method: 'PUT', url: GOALS_URL, payload: GOALS }, null), 401)
  })
})
