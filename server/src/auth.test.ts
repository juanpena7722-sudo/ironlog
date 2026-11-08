import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance, InjectOptions } from 'fastify'
import { buildApp } from './app.js'
import { TEST_ENV, truncateTables } from './test/db.js'

const EMAIL = 'lifter@example.com'
const PASSWORD = 'correct horse battery'
const HOST = 'ironlog.test'
const DATE = new Date('2026-01-15')

let app: FastifyInstance
let logLines: string[]

beforeEach(async () => {
  logLines = []
  app = buildApp(TEST_ENV, { write: (message) => logLines.push(message) })
  await truncateTables(app.db)
})

afterEach(async () => {
  vi.useRealTimers()
  await app.close()
})

function send(options: InjectOptions) {
  return app.inject({ ...options, headers: { host: HOST, ...options.headers } })
}

function register(email = EMAIL, password = PASSWORD) {
  return send({ method: 'POST', url: '/api/v1/auth/register', payload: { email, password } })
}

function login(email = EMAIL, password = PASSWORD) {
  return send({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password } })
}

function me(session?: string) {
  return send({
    method: 'GET',
    url: '/api/v1/auth/me',
    cookies: session === undefined ? {} : { session },
  })
}

async function registerSession(email = EMAIL) {
  const response = await register(email)
  return sessionOf(response)
}

function sessionOf(response: Awaited<ReturnType<typeof send>>) {
  const cookie = response.cookies.find((entry) => entry.name === 'session')
  if (!cookie) throw new Error('No session cookie')
  return cookie
}

function expectProblem(response: Awaited<ReturnType<typeof send>>, status: number) {
  expect(response.statusCode).toBe(status)
  expect(response.headers['content-type']).toMatch(/^application\/problem\+json/)
  expect(response.json()).toMatchObject({ type: 'about:blank', status })
}

describe('POST /api/v1/auth/register', () => {
  it('returns 201, a session cookie and creates default goals', async () => {
    const response = await register('  Lifter@Example.COM ')
    expect(response.statusCode).toBe(201)
    const user = await app.db.user.findUniqueOrThrow({ where: { email: EMAIL } })
    expect(response.json()).toEqual({ id: user.id, email: EMAIL })
    expect(user.passwordHash).toMatch(/^\$argon2id\$/)
    expect(sessionOf(response)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/api/v1',
      maxAge: 7 * 24 * 60 * 60,
    })
    const goals = await app.db.goals.findUniqueOrThrow({ where: { userId: user.id } })
    expect(goals).toMatchObject({ unit: 'kg', calories: 2800, waterL: 4, sleepHours: 8 })
  })

  it('returns 400 for invalid input', async () => {
    expectProblem(await register('not-an-email'), 400)
    expectProblem(await register(EMAIL, 'short'), 400)
    expectProblem(await register(EMAIL, 'x'.repeat(129)), 400)
  })

  it('returns 409 for a duplicate email in any case', async () => {
    await register()
    const response = await register('LIFTER@example.com')
    expectProblem(response, 409)
    expect(response.json().detail).toBe('Email already registered')
  })
})

describe('POST /api/v1/auth/login', () => {
  it('returns 200 and a session cookie', async () => {
    const { id } = (await register()).json()
    const response = await login(' LIFTER@example.com')
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ id, email: EMAIL })
    const { value } = sessionOf(response)
    expect((await me(value)).json()).toEqual({ id, email: EMAIL })
  })

  it('returns 401 with the same detail for a wrong password or unknown email', async () => {
    await register()
    const wrongPassword = await login(EMAIL, 'wrong password!')
    const unknownEmail = await login('nobody@example.com')
    expectProblem(wrongPassword, 401)
    expectProblem(unknownEmail, 401)
    expect(wrongPassword.json().detail).toBe('Invalid email or password')
    expect(unknownEmail.json().detail).toBe(wrongPassword.json().detail)
    expect(wrongPassword.cookies).toHaveLength(0)
  })

  it('returns 401 for a user whose stored hash is not argon2', async () => {
    await app.db.user.create({ data: { email: 'demo@ironlog.local', passwordHash: '' } })
    expectProblem(await login('demo@ironlog.local'), 401)
  })

  it('returns 400 for invalid input', async () => {
    expectProblem(await send({ method: 'POST', url: '/api/v1/auth/login', payload: {} }), 400)
  })
})

describe('GET /api/v1/auth/me', () => {
  it('returns 401 without a session', async () => {
    const response = await me()
    expectProblem(response, 401)
    expect(response.json().detail).toBe('Not authenticated')
  })

  it('returns 401 for a tampered token', async () => {
    const { value } = await registerSession()
    const [header, payload, signature] = value.split('.')
    const forged = Buffer.from(JSON.stringify({ sub: crypto.randomUUID() })).toString('base64url')
    expectProblem(await me(`${header}.${forged}.${signature}`), 401)
    expectProblem(await me(`${header}.${payload}.${signature.slice(0, -2)}xx`), 401)
  })

  it('returns 401 for a token signed with another secret', async () => {
    const other = buildApp({ ...TEST_ENV, JWT_SECRET: 'b'.repeat(32) })
    await other.ready()
    const token = other.jwt.sign({ sub: crypto.randomUUID() })
    await other.close()
    expectProblem(await me(token), 401)
  })

  it('returns 401 for an expired token', async () => {
    const { value } = await registerSession()
    expect((await me(value)).statusCode).toBe(200)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 7 * 24 * 60 * 60 * 1000 + 1000)
    expectProblem(await me(value), 401)
  })

  it('ignores a bearer token', async () => {
    const { value } = await registerSession()
    const response = await send({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${value}` },
    })
    expectProblem(response, 401)
  })
})

describe('POST /api/v1/auth/logout', () => {
  it('returns 204 and clears the session cookie', async () => {
    const { value } = await registerSession()
    const response = await send({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: { session: value },
    })
    expect(response.statusCode).toBe(204)
    expect(sessionOf(response)).toMatchObject({ value: '', path: '/api/v1' })
  })
})

describe('DELETE /api/v1/auth/account', () => {
  function deleteAccount(session: string | undefined, payload: object) {
    return send({
      method: 'DELETE',
      url: '/api/v1/auth/account',
      cookies: session === undefined ? {} : { session },
      payload,
    })
  }

  async function seedRows(userId: string) {
    await app.db.workout.create({
      data: {
        userId,
        date: DATE,
        name: 'Push day',
        exercises: {
          create: {
            userId,
            position: 0,
            name: 'Bench',
            muscle: 'Chest',
            sets: { create: { userId, position: 0, reps: 5, weight: 100 } },
          },
        },
      },
    })
    await app.db.foodEntry.create({
      data: {
        userId,
        date: DATE,
        meal: 'Lunch',
        name: 'Rice',
        calories: 200,
        protein: 4,
        carbs: 45,
        fat: 1,
      },
    })
    await app.db.bodyEntry.create({ data: { userId, date: DATE, weight: 82.5 } })
    await app.db.healthEntry.create({ data: { userId, date: DATE, steps: 9000 } })
  }

  async function countRows(userId: string) {
    const where = { userId }
    return Promise.all([
      app.db.user.count({ where: { id: userId } }),
      app.db.goals.count({ where }),
      app.db.workout.count({ where }),
      app.db.exercise.count({ where }),
      app.db.workoutSet.count({ where }),
      app.db.foodEntry.count({ where }),
      app.db.bodyEntry.count({ where }),
      app.db.healthEntry.count({ where }),
    ])
  }

  it('returns 204 and removes all of the user rows only', async () => {
    const session = await registerSession()
    const otherSession = await registerSession('other@example.com')
    const { id } = (await me(session.value)).json()
    const { id: otherId } = (await me(otherSession.value)).json()
    await seedRows(id)
    await seedRows(otherId)

    const response = await deleteAccount(session.value, { password: PASSWORD })
    expect(response.statusCode).toBe(204)
    expect(sessionOf(response).value).toBe('')
    expect(await countRows(id)).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
    expect(await countRows(otherId)).toEqual([1, 1, 1, 1, 1, 1, 1, 1])
    expectProblem(await me(session.value), 401)
  })

  it('returns 401 for a wrong password and keeps the account', async () => {
    const { value } = await registerSession()
    expectProblem(await deleteAccount(value, { password: 'wrong password!' }), 401)
    expect(await app.db.user.count()).toBe(1)
  })

  it('returns 401 without a session', async () => {
    expectProblem(await deleteAccount(undefined, { password: PASSWORD }), 401)
  })

  it('returns 400 without a password', async () => {
    const { value } = await registerSession()
    expectProblem(await deleteAccount(value, {}), 400)
  })
})

describe('Origin check', () => {
  it('returns 403 for a state-changing request with a foreign Origin', async () => {
    const response = await send({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: { origin: 'https://evil.example' },
      payload: { email: EMAIL, password: PASSWORD },
    })
    expectProblem(response, 403)
    expect(await app.db.user.count()).toBe(0)
  })

  it('returns 403 for an unparseable Origin', async () => {
    const response = await send({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { origin: 'null' },
    })
    expectProblem(response, 403)
  })

  it('allows a same-origin state-changing request', async () => {
    const response = await send({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: { origin: `https://${HOST}` },
      payload: { email: EMAIL, password: PASSWORD },
    })
    expect(response.statusCode).toBe(201)
  })

  it('allows a safe request with a foreign Origin', async () => {
    const response = await send({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'https://evil.example' },
    })
    expect(response.statusCode).toBe(200)
  })
})

describe('rate limit', () => {
  it('returns 429 after 10 auth requests per minute from one IP', async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      expect((await login('nobody@example.com')).statusCode).toBe(401)
    }
    expectProblem(await login('nobody@example.com'), 429)
  })
})

describe('password hash', () => {
  it('never appears in a response or log', async () => {
    const bodies = [await register(), await login(), await login(EMAIL, 'wrong password!')].map(
      (response) => response.body,
    )
    const session = sessionOf(await login())
    bodies.push((await me(session.value)).body)
    const { passwordHash } = await app.db.user.findUniqueOrThrow({ where: { email: EMAIL } })
    bodies.push(
      (
        await send({
          method: 'DELETE',
          url: '/api/v1/auth/account',
          cookies: { session: session.value },
          payload: { password: PASSWORD },
        })
      ).body,
    )

    const output = [...bodies, ...logLines].join('\n')
    expect(logLines.length).toBeGreaterThan(0)
    expect(output).not.toContain(passwordHash)
    expect(output).not.toContain('$argon2')
    expect(output).not.toContain(PASSWORD)
  })
})
