import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance, InjectOptions } from 'fastify'
import { BodyEntrySchema } from '../../shared/schemas.js'
import { buildApp } from './app.js'
import { TEST_ENV, truncateTables } from './test/db.js'

const BODY_URL = '/api/v1/body'
const MISSING_ID = '00000000-0000-4000-8000-000000000000'
const ENTRY = {
  date: '2026-03-10',
  weight: 82.45,
  bodyFat: 18.5,
  chest: 104.5,
  waist: 86,
  arms: 38.25,
  thighs: 60,
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

async function create(payload: object = ENTRY, cookie = session) {
  const response = await send({ method: 'POST', url: BODY_URL, payload }, cookie)
  expect(response.statusCode).toBe(201)
  return BodyEntrySchema.parse(response.json())
}

async function list(cookie = session) {
  const response = await send({ method: 'GET', url: `${BODY_URL}?from=2026-01-01` }, cookie)
  return response.json()
}

function expectProblem(response: Awaited<ReturnType<typeof send>>, status: number) {
  expect(response.statusCode).toBe(status)
  expect(response.headers['content-type']).toMatch(/^application\/problem\+json/)
  expect(response.json()).toMatchObject({ type: 'about:blank', status })
}

describe('POST /body', () => {
  it('creates a body entry with numeric kg and cm values', async () => {
    expect(await create()).toEqual({ ...ENTRY, id: expect.any(String) })
  })

  it('omits empty optional fields from the response', async () => {
    const response = await send({
      method: 'POST',
      url: BODY_URL,
      payload: { date: '2026-03-10', weight: 80 },
    })
    expect(response.json()).toEqual({ id: expect.any(String), date: '2026-03-10', weight: 80 })
  })

  it('returns 400 for an invalid body', async () => {
    const response = await send({
      method: 'POST',
      url: BODY_URL,
      payload: { ...ENTRY, date: '2026-02-30', weight: -1, bodyFat: 101, waist: -2 },
    })
    expectProblem(response, 400)
    const paths = response.json().errors.map((error: { path: string }) => error.path)
    expect(paths).toEqual(expect.arrayContaining(['date', 'weight', 'bodyFat', 'waist']))
  })

  it('returns 400 for measurements above 1000 cm', async () => {
    const response = await send({
      method: 'POST',
      url: BODY_URL,
      payload: { ...ENTRY, chest: 1001, waist: 1001, arms: 1001, thighs: 1001 },
    })
    expectProblem(response, 400)
    const paths = response.json().errors.map((error: { path: string }) => error.path)
    expect(paths).toEqual(expect.arrayContaining(['chest', 'waist', 'arms', 'thighs']))
  })

  it('returns 401 without a session', async () => {
    expectProblem(await send({ method: 'POST', url: BODY_URL, payload: ENTRY }, null), 401)
  })
})

describe('GET /body', () => {
  it('filters by an inclusive date range, newest first', async () => {
    for (const date of ['2026-03-01', '2026-03-05', '2026-03-10', '2026-03-15']) {
      await create({ ...ENTRY, date })
    }
    const response = await send({ method: 'GET', url: `${BODY_URL}?from=2026-03-05&to=2026-03-10` })
    expect(response.statusCode).toBe(200)
    expect(response.json().map((entry: { date: string }) => entry.date)).toEqual([
      '2026-03-10',
      '2026-03-05',
    ])
  })

  it('defaults to the last 90 days', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-06-30T12:00:00Z'))
    for (const date of ['2026-03-31', '2026-04-01', '2026-06-30']) {
      await create({ ...ENTRY, date })
    }
    const response = await send({ method: 'GET', url: BODY_URL })
    expect(response.json().map((entry: { date: string }) => entry.date)).toEqual([
      '2026-06-30',
      '2026-04-01',
    ])
  })

  it('returns 400 for an invalid date filter', async () => {
    expectProblem(await send({ method: 'GET', url: `${BODY_URL}?from=2026-13-01` }), 400)
  })

  it('returns 401 without a session', async () => {
    expectProblem(await send({ method: 'GET', url: BODY_URL }, null), 401)
  })

  it("excludes another user's body entries", async () => {
    await create(ENTRY, await createSession('other@example.com'))
    expect(await list()).toEqual([])
  })
})

describe('PUT /body/:id', () => {
  it('replaces the body entry and clears dropped fields', async () => {
    const entry = await create()
    const replacement = { date: '2026-03-11', weight: 81.5, waist: 85.5 }
    const response = await send({
      method: 'PUT',
      url: `${BODY_URL}/${entry.id}`,
      payload: replacement,
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ...replacement, id: entry.id })
    expect(await list()).toEqual([{ ...replacement, id: entry.id }])
  })

  it('returns 400 for an invalid body', async () => {
    const entry = await create()
    const response = await send({
      method: 'PUT',
      url: `${BODY_URL}/${entry.id}`,
      payload: { ...ENTRY, weight: 2001 },
    })
    expectProblem(response, 400)
  })

  it('returns 400 for a malformed id', async () => {
    expectProblem(await send({ method: 'PUT', url: `${BODY_URL}/not-a-uuid`, payload: ENTRY }), 400)
  })

  it('returns 404 for an unknown id', async () => {
    expectProblem(
      await send({ method: 'PUT', url: `${BODY_URL}/${MISSING_ID}`, payload: ENTRY }),
      404,
    )
  })

  it('returns 401 without a session', async () => {
    const response = await send(
      { method: 'PUT', url: `${BODY_URL}/${MISSING_ID}`, payload: ENTRY },
      null,
    )
    expectProblem(response, 401)
  })

  it("returns 404 for another user's body entry and leaves it unchanged", async () => {
    const otherSession = await createSession('other@example.com')
    const entry = await create(ENTRY, otherSession)
    const response = await send({
      method: 'PUT',
      url: `${BODY_URL}/${entry.id}`,
      payload: { ...ENTRY, weight: 50 },
    })
    expectProblem(response, 404)
    expect(await list(otherSession)).toEqual([entry])
  })
})

describe('DELETE /body/:id', () => {
  it('deletes the body entry', async () => {
    const entry = await create()
    const response = await send({ method: 'DELETE', url: `${BODY_URL}/${entry.id}` })
    expect(response.statusCode).toBe(204)
    expect(response.body).toBe('')
    expect(await list()).toEqual([])
  })

  it('returns 404 for an unknown id', async () => {
    expectProblem(await send({ method: 'DELETE', url: `${BODY_URL}/${MISSING_ID}` }), 404)
  })

  it('returns 400 for a malformed id', async () => {
    expectProblem(await send({ method: 'DELETE', url: `${BODY_URL}/not-a-uuid` }), 400)
  })

  it('returns 401 without a session', async () => {
    expectProblem(await send({ method: 'DELETE', url: `${BODY_URL}/${MISSING_ID}` }, null), 401)
  })

  it("returns 404 for another user's body entry and keeps it", async () => {
    const otherSession = await createSession('other@example.com')
    const entry = await create(ENTRY, otherSession)
    expectProblem(await send({ method: 'DELETE', url: `${BODY_URL}/${entry.id}` }), 404)
    expect(await list(otherSession)).toEqual([entry])
  })
})
