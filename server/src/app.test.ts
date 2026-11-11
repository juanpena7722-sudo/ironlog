import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { buildApp } from './app.js'
import type { Env } from './env.js'
import { TEST_ENV } from './test/db.js'

const INTERNAL_MESSAGE = 'relation "users" does not exist'

function buildTestApp(nodeEnv: Env['NODE_ENV'] = 'test') {
  const app = buildApp({ ...TEST_ENV, NODE_ENV: nodeEnv })
  app.post('/test/validate', async (request) => z.object({ name: z.string() }).parse(request.body))
  app.get('/test/fail', async () => {
    throw new Error(INTERNAL_MESSAGE)
  })
  return app
}

describe('buildApp', () => {
  it('GET /api/v1/health returns 200 { status: "ok" }', async () => {
    const response = await buildTestApp().inject({ method: 'GET', url: '/api/v1/health' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })

  it('unknown route returns 404 Problem Details', async () => {
    const response = await buildTestApp().inject({ method: 'GET', url: '/api/v1/nope' })
    expect(response.statusCode).toBe(404)
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/)
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Route GET /api/v1/nope not found',
    })
  })

  it('Zod validation error returns 400 Problem Details with errors', async () => {
    const response = await buildTestApp().inject({
      method: 'POST',
      url: '/test/validate',
      payload: { name: 1 },
    })
    expect(response.statusCode).toBe(400)
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/)
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Invalid input',
      errors: [{ path: 'name', message: expect.any(String) }],
    })
  })

  it('httpErrors from @fastify/sensible return Problem Details', async () => {
    const app = buildTestApp()
    app.get('/test/conflict', async () => {
      throw app.httpErrors.conflict('Email already registered')
    })
    const response = await app.inject({ method: 'GET', url: '/test/conflict' })
    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'Email already registered',
    })
  })

  it('unexpected error returns 500 Problem Details', async () => {
    const response = await buildTestApp().inject({ method: 'GET', url: '/test/fail' })
    expect(response.statusCode).toBe(500)
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/)
    expect(response.json()).toMatchObject({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
    })
  })

  it('500 hides internals in production', async () => {
    const response = await buildTestApp('production').inject({ method: 'GET', url: '/test/fail' })
    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred',
    })
    expect(response.body).not.toContain(INTERNAL_MESSAGE)
    expect(response.body).not.toContain('at ')
  })
})

describe('hardening', () => {
  it('sets security headers including CSP and the global rate limit', async () => {
    const response = await buildTestApp().inject({ method: 'GET', url: '/api/v1/health' })
    expect(response.headers['content-security-policy']).toContain("default-src 'self'")
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN')
    expect(response.headers['strict-transport-security']).toContain('max-age=')
    expect(response.headers['x-ratelimit-limit']).toBe('300')
  })

  it('redacts secrets from logs', async () => {
    const lines: string[] = []
    const app = buildApp(TEST_ENV, { write: (line) => lines.push(line) })
    app.post('/test/log', async (request) => {
      request.log.info({
        request: { headers: request.headers },
        response: { headers: { 'set-cookie': 'session=reply-token' } },
        password: 'top-level-secret',
        body: request.body,
      })
      return { isLogged: true }
    })
    const response = await app.inject({
      method: 'POST',
      url: '/test/log',
      headers: { authorization: 'Bearer header-token', cookie: 'session=request-token' },
      payload: { email: 'a@b.co', password: 'body-secret' },
    })
    expect(response.statusCode).toBe(200)
    const output = lines.join('')
    expect(output).toContain('[Redacted]')
    for (const secret of [
      'header-token',
      'request-token',
      'reply-token',
      'top-level-secret',
      'body-secret',
    ]) {
      expect(output).not.toContain(secret)
    }
  })

  it('serves the OpenAPI document at /docs outside production', async () => {
    const response = await buildTestApp('development').inject({ method: 'GET', url: '/docs' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ openapi: expect.any(String) })
  })

  it('returns 404 for /docs in production', async () => {
    const response = await buildTestApp('production').inject({ method: 'GET', url: '/docs' })
    expect(response.statusCode).toBe(404)
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/)
  })

  it('rejects bodies over the limit with 413 Problem Details', async () => {
    const response = await buildTestApp().inject({
      method: 'POST',
      url: '/test/validate',
      payload: { name: 'x'.repeat(200 * 1024) },
    })
    expect(response.statusCode).toBe(413)
    expect(response.json()).toMatchObject({ title: 'Payload Too Large', status: 413 })
  })
})
