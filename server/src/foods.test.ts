import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance, InjectOptions } from 'fastify'
import { FoodEntrySchema } from '../../shared/schemas.js'
import { buildApp } from './app.js'
import { TEST_ENV, truncateTables } from './test/db.js'

const FOODS_URL = '/api/v1/foods'
const MISSING_ID = '00000000-0000-4000-8000-000000000000'
const FOOD = {
  date: '2026-03-10',
  meal: 'Lunch',
  name: 'Chicken Rice',
  calories: 650.5,
  protein: 45,
  carbs: 80,
  fat: 12.5,
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

async function create(payload: object = FOOD, cookie = session) {
  const response = await send({ method: 'POST', url: FOODS_URL, payload }, cookie)
  expect(response.statusCode).toBe(201)
  return FoodEntrySchema.parse(response.json())
}

async function list(cookie = session) {
  const response = await send({ method: 'GET', url: `${FOODS_URL}?from=2026-01-01` }, cookie)
  return response.json()
}

async function seedRecent(names: string[]) {
  const { id: userId } = await app.db.user.findUniqueOrThrow({
    where: { email: 'lifter@example.com' },
  })
  await app.db.foodEntry.createMany({
    data: names.map((name, index) => ({
      ...FOOD,
      name,
      userId,
      date: new Date(FOOD.date),
      meal: 'Lunch' as const,
      createdAt: new Date(Date.UTC(2026, 2, 1, 0, index)),
    })),
  })
}

function expectProblem(response: Awaited<ReturnType<typeof send>>, status: number) {
  expect(response.statusCode).toBe(status)
  expect(response.headers['content-type']).toMatch(/^application\/problem\+json/)
  expect(response.json()).toMatchObject({ type: 'about:blank', status })
}

describe('POST /foods', () => {
  it('creates a food entry', async () => {
    expect(await create()).toEqual({ ...FOOD, id: expect.any(String) })
  })

  it('returns 400 for an invalid body', async () => {
    const response = await send({
      method: 'POST',
      url: FOODS_URL,
      payload: { ...FOOD, date: '2026-02-30', meal: 'Brunch', name: '', calories: -1 },
    })
    expectProblem(response, 400)
    const paths = response.json().errors.map((error: { path: string }) => error.path)
    expect(paths).toEqual(expect.arrayContaining(['date', 'meal', 'name', 'calories']))
  })

  it('returns 400 for a name containing a NUL character', async () => {
    const payload = { ...FOOD, name: 'Chicken\u0000Rice' }
    expectProblem(await send({ method: 'POST', url: FOODS_URL, payload }), 400)
  })

  it('returns 401 without a session', async () => {
    expectProblem(await send({ method: 'POST', url: FOODS_URL, payload: FOOD }, null), 401)
  })
})

describe('GET /foods', () => {
  it('filters by an inclusive date range, newest first', async () => {
    for (const date of ['2026-03-01', '2026-03-05', '2026-03-10', '2026-03-15']) {
      await create({ ...FOOD, date })
    }
    const response = await send({
      method: 'GET',
      url: `${FOODS_URL}?from=2026-03-05&to=2026-03-10`,
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().map((food: { date: string }) => food.date)).toEqual([
      '2026-03-10',
      '2026-03-05',
    ])
  })

  it('defaults to the last 30 days', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-06-30T12:00:00Z'))
    for (const date of ['2026-05-30', '2026-05-31', '2026-06-30']) {
      await create({ ...FOOD, date })
    }
    const response = await send({ method: 'GET', url: FOODS_URL })
    expect(response.json().map((food: { date: string }) => food.date)).toEqual([
      '2026-06-30',
      '2026-05-31',
    ])
  })

  it('returns 400 for an invalid date filter', async () => {
    expectProblem(await send({ method: 'GET', url: `${FOODS_URL}?to=2026-13-01` }), 400)
  })

  it('returns 401 without a session', async () => {
    expectProblem(await send({ method: 'GET', url: FOODS_URL }, null), 401)
  })

  it("excludes another user's food entries", async () => {
    await create(FOOD, await createSession('other@example.com'))
    expect(await list()).toEqual([])
  })
})

describe('GET /foods/recent', () => {
  it('returns distinct names case-insensitively, most recent first', async () => {
    await seedRecent(['Oats', 'Eggs', 'oats', 'Banana', 'EGGS'])
    const response = await send({ method: 'GET', url: `${FOODS_URL}/recent` })
    expect(response.statusCode).toBe(200)
    expect(response.json().map((food: { name: string }) => food.name)).toEqual([
      'EGGS',
      'Banana',
      'oats',
    ])
  })

  it('respects limit', async () => {
    await seedRecent(['A', 'B', 'C', 'c', 'D'])
    const response = await send({ method: 'GET', url: `${FOODS_URL}/recent?limit=2` })
    expect(response.json().map((food: { name: string }) => food.name)).toEqual(['D', 'c'])
  })

  it('defaults to 20 entries', async () => {
    await seedRecent(Array.from({ length: 25 }, (_, index) => `Food ${index}`))
    const response = await send({ method: 'GET', url: `${FOODS_URL}/recent` })
    expect(response.json()).toHaveLength(20)
  })

  it('reads past a batch of 100 duplicates to find older names', async () => {
    await seedRecent(['Eggs', ...Array.from({ length: 100 }, () => 'Oats')])
    const response = await send({ method: 'GET', url: `${FOODS_URL}/recent` })
    expect(response.json().map((food: { name: string }) => food.name)).toEqual(['Oats', 'Eggs'])
  })

  it('returns 400 for an invalid limit', async () => {
    for (const limit of ['0', '51', 'abc']) {
      expectProblem(await send({ method: 'GET', url: `${FOODS_URL}/recent?limit=${limit}` }), 400)
    }
  })

  it('returns 401 without a session', async () => {
    expectProblem(await send({ method: 'GET', url: `${FOODS_URL}/recent` }, null), 401)
  })

  it("excludes another user's food entries", async () => {
    await create(FOOD, await createSession('other@example.com'))
    const response = await send({ method: 'GET', url: `${FOODS_URL}/recent` })
    expect(response.json()).toEqual([])
  })
})

describe('PUT /foods/:id', () => {
  it('replaces the food entry', async () => {
    const food = await create()
    const replacement = { ...FOOD, meal: 'Dinner', name: 'Salmon', calories: 500 }
    const response = await send({
      method: 'PUT',
      url: `${FOODS_URL}/${food.id}`,
      payload: replacement,
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ...replacement, id: food.id })
    expect(await list()).toEqual([{ ...replacement, id: food.id }])
  })

  it('returns 400 for an invalid body', async () => {
    const food = await create()
    const response = await send({
      method: 'PUT',
      url: `${FOODS_URL}/${food.id}`,
      payload: { ...FOOD, protein: -5 },
    })
    expectProblem(response, 400)
  })

  it('returns 400 for a malformed id', async () => {
    expectProblem(await send({ method: 'PUT', url: `${FOODS_URL}/not-a-uuid`, payload: FOOD }), 400)
  })

  it('returns 404 for an unknown id', async () => {
    expectProblem(
      await send({ method: 'PUT', url: `${FOODS_URL}/${MISSING_ID}`, payload: FOOD }),
      404,
    )
  })

  it('returns 401 without a session', async () => {
    const response = await send(
      { method: 'PUT', url: `${FOODS_URL}/${MISSING_ID}`, payload: FOOD },
      null,
    )
    expectProblem(response, 401)
  })

  it("returns 404 for another user's food entry and leaves it unchanged", async () => {
    const otherSession = await createSession('other@example.com')
    const food = await create(FOOD, otherSession)
    const response = await send({
      method: 'PUT',
      url: `${FOODS_URL}/${food.id}`,
      payload: { ...FOOD, name: 'Hijacked' },
    })
    expectProblem(response, 404)
    expect(await list(otherSession)).toEqual([food])
  })
})

describe('DELETE /foods/:id', () => {
  it('deletes the food entry', async () => {
    const food = await create()
    const response = await send({ method: 'DELETE', url: `${FOODS_URL}/${food.id}` })
    expect(response.statusCode).toBe(204)
    expect(response.body).toBe('')
    expect(await list()).toEqual([])
  })

  it('returns 404 for an unknown id', async () => {
    expectProblem(await send({ method: 'DELETE', url: `${FOODS_URL}/${MISSING_ID}` }), 404)
  })

  it('returns 400 for a malformed id', async () => {
    expectProblem(await send({ method: 'DELETE', url: `${FOODS_URL}/not-a-uuid` }), 400)
  })

  it('returns 401 without a session', async () => {
    expectProblem(await send({ method: 'DELETE', url: `${FOODS_URL}/${MISSING_ID}` }, null), 401)
  })

  it("returns 404 for another user's food entry and keeps it", async () => {
    const otherSession = await createSession('other@example.com')
    const food = await create(FOOD, otherSession)
    expectProblem(await send({ method: 'DELETE', url: `${FOODS_URL}/${food.id}` }), 404)
    expect(await list(otherSession)).toEqual([food])
  })
})
