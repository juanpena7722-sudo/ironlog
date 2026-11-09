import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance, InjectOptions } from 'fastify'
import { HealthEntrySchema } from '../../shared/schemas.js'
import { buildApp } from './app.js'
import { TEST_ENV, truncateTables } from './test/db.js'

const HEALTH_URL = '/api/v1/health-entries'
const DATE = '2026-03-10'
const ENTRY = {
  sleepHours: 7.5,
  waterL: 2.5,
  restingHR: 58,
  steps: 9500,
  energy: 4,
  notes: 'Felt good',
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

async function upsert(date = DATE, payload: object = ENTRY, cookie = session) {
  const response = await send({ method: 'PUT', url: `${HEALTH_URL}/${date}`, payload }, cookie)
  expect(response.statusCode).toBe(200)
  return HealthEntrySchema.parse(response.json())
}

async function list(cookie = session) {
  const response = await send({ method: 'GET', url: `${HEALTH_URL}?from=2026-01-01` }, cookie)
  return response.json()
}

function expectProblem(response: Awaited<ReturnType<typeof send>>, status: number) {
  expect(response.statusCode).toBe(status)
  expect(response.headers['content-type']).toMatch(/^application\/problem\+json/)
  expect(response.json()).toMatchObject({ type: 'about:blank', status })
}

describe('PUT /health-entries/:date', () => {
  it('creates a health entry for the date', async () => {
    expect(await upsert()).toEqual({ ...ENTRY, id: expect.any(String), date: DATE })
  })

  it('updates the existing entry on the same date', async () => {
    const created = await upsert()
    const updated = await upsert(DATE, { sleepHours: 6, energy: 2 })
    expect(updated).toEqual({ id: created.id, date: DATE, sleepHours: 6, energy: 2 })
    expect(await list()).toEqual([updated])
  })

  it('omits empty optional fields from the response', async () => {
    expect(await upsert(DATE, {})).toEqual({ id: expect.any(String), date: DATE })
  })

  it('returns 400 for an invalid body', async () => {
    const response = await send({
      method: 'PUT',
      url: `${HEALTH_URL}/${DATE}`,
      payload: { sleepHours: 25, steps: 1.5, energy: 6 },
    })
    expectProblem(response, 400)
    const paths = response.json().errors.map((error: { path: string }) => error.path)
    expect(paths).toEqual(expect.arrayContaining(['sleepHours', 'steps', 'energy']))
  })

  it('returns 400 for an invalid date', async () => {
    for (const date of ['2026-02-30', 'not-a-date']) {
      expectProblem(
        await send({ method: 'PUT', url: `${HEALTH_URL}/${date}`, payload: ENTRY }),
        400,
      )
    }
  })

  it('returns 401 without a session', async () => {
    const response = await send(
      { method: 'PUT', url: `${HEALTH_URL}/${DATE}`, payload: ENTRY },
      null,
    )
    expectProblem(response, 401)
  })

  it("keeps another user's entry on the same date separate and unchanged", async () => {
    const otherSession = await createSession('other@example.com')
    const other = await upsert(DATE, ENTRY, otherSession)
    const mine = await upsert(DATE, { steps: 100 })
    expect(mine.id).not.toBe(other.id)
    expect(await list(otherSession)).toEqual([other])
  })
})

describe('GET /health-entries', () => {
  it('filters by an inclusive date range, newest first', async () => {
    for (const date of ['2026-03-01', '2026-03-05', '2026-03-10', '2026-03-15']) {
      await upsert(date)
    }
    const response = await send({
      method: 'GET',
      url: `${HEALTH_URL}?from=2026-03-05&to=2026-03-10`,
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().map((entry: { date: string }) => entry.date)).toEqual([
      '2026-03-10',
      '2026-03-05',
    ])
  })

  it('defaults to the last 30 days', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-06-30T12:00:00Z'))
    for (const date of ['2026-05-30', '2026-05-31', '2026-06-30']) {
      await upsert(date)
    }
    const response = await send({ method: 'GET', url: HEALTH_URL })
    expect(response.json().map((entry: { date: string }) => entry.date)).toEqual([
      '2026-06-30',
      '2026-05-31',
    ])
  })

  it('returns 400 for an invalid date filter', async () => {
    expectProblem(await send({ method: 'GET', url: `${HEALTH_URL}?to=2026-13-01` }), 400)
  })

  it('returns 401 without a session', async () => {
    expectProblem(await send({ method: 'GET', url: HEALTH_URL }, null), 401)
  })

  it("excludes another user's health entries", async () => {
    await upsert(DATE, ENTRY, await createSession('other@example.com'))
    expect(await list()).toEqual([])
  })
})

describe('DELETE /health-entries/:date', () => {
  it('deletes the health entry', async () => {
    await upsert()
    const response = await send({ method: 'DELETE', url: `${HEALTH_URL}/${DATE}` })
    expect(response.statusCode).toBe(204)
    expect(response.body).toBe('')
    expect(await list()).toEqual([])
  })

  it('returns 404 when there is no entry for the date', async () => {
    expectProblem(await send({ method: 'DELETE', url: `${HEALTH_URL}/${DATE}` }), 404)
  })

  it('returns 400 for an invalid date', async () => {
    expectProblem(await send({ method: 'DELETE', url: `${HEALTH_URL}/2026-02-30` }), 400)
  })

  it('returns 401 without a session', async () => {
    expectProblem(await send({ method: 'DELETE', url: `${HEALTH_URL}/${DATE}` }, null), 401)
  })

  it("returns 404 for another user's health entry and keeps it", async () => {
    const otherSession = await createSession('other@example.com')
    const entry = await upsert(DATE, ENTRY, otherSession)
    expectProblem(await send({ method: 'DELETE', url: `${HEALTH_URL}/${DATE}` }), 404)
    expect(await list(otherSession)).toEqual([entry])
  })
})
