import { QueryClient } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { z, ZodError } from 'zod'
import { GoalsSchema } from '@shared/schemas'
import { GOALS } from '../test/handlers'
import { server } from '../test/setup'
import { ApiError, apiRequest, shouldRetry } from './client'

describe('apiRequest', () => {
  it('parses a successful response with the shared schema', async () => {
    await expect(apiRequest('/goals', GoalsSchema)).resolves.toEqual(GOALS)
  })

  it('sends same-origin credentials to the fixed /api/v1 base', async () => {
    let request: Request | undefined
    server.use(
      http.get('/api/v1/goals', (info) => {
        request = info.request
        return HttpResponse.json(GOALS)
      }),
    )
    await apiRequest('/goals', GoalsSchema)
    expect(new URL(request!.url).pathname).toBe('/api/v1/goals')
    expect(request!.credentials).toBe('same-origin')
  })

  it('turns Problem Details into an ApiError', async () => {
    server.use(
      http.get('/api/v1/goals', () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'Not Found', status: 404, detail: 'Goals not found' },
          { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    const error = await apiRequest('/goals', GoalsSchema).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, title: 'Not Found', detail: 'Goals not found' })
  })

  it('falls back to the status text when the error body is not Problem Details', async () => {
    server.use(
      http.get(
        '/api/v1/goals',
        () => new HttpResponse('<html>', { status: 502, statusText: 'Bad Gateway' }),
      ),
    )
    const error = await apiRequest('/goals', GoalsSchema).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 502, title: 'Bad Gateway', detail: undefined })
  })

  it('resolves a 204 response with no body', async () => {
    server.use(http.post('/api/v1/auth/logout', () => new HttpResponse(null, { status: 204 })))
    await expect(
      apiRequest('/auth/logout', z.undefined(), { method: 'POST' }),
    ).resolves.toBeUndefined()
  })

  it('rejects a body that is not JSON', async () => {
    server.use(http.get('/api/v1/goals', () => new HttpResponse('<html>', { status: 200 })))
    await expect(apiRequest('/goals', GoalsSchema)).rejects.toThrow(SyntaxError)
  })

  it('rejects a malformed response', async () => {
    server.use(http.get('/api/v1/goals', () => HttpResponse.json({ ...GOALS, calories: 'lots' })))
    await expect(apiRequest('/goals', GoalsSchema)).rejects.toBeInstanceOf(ZodError)
  })

  it('surfaces a network failure', async () => {
    server.use(http.get('/api/v1/goals', () => HttpResponse.error()))
    await expect(apiRequest('/goals', GoalsSchema)).rejects.toThrow(TypeError)
  })
})

describe('shouldRetry', () => {
  function fetchGoalsWithRetry() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: shouldRetry, retryDelay: 0 } },
    })
    return queryClient.fetchQuery({
      queryKey: ['goals'],
      queryFn: () => apiRequest('/goals', GoalsSchema),
    })
  }

  function countRequests(status: number) {
    const calls = { count: 0 }
    server.use(
      http.get('/api/v1/goals', () => {
        calls.count += 1
        return HttpResponse.json({ title: 'Error', status }, { status })
      }),
    )
    return calls
  }

  it('retries once on a 5xx response', async () => {
    const calls = countRequests(503)
    await expect(fetchGoalsWithRetry()).rejects.toBeInstanceOf(ApiError)
    expect(calls.count).toBe(2)
  })

  it('does not retry on a 4xx response', async () => {
    const calls = countRequests(401)
    await expect(fetchGoalsWithRetry()).rejects.toBeInstanceOf(ApiError)
    expect(calls.count).toBe(1)
  })

  it('does not retry an error that is not an ApiError', () => {
    expect(shouldRetry(0, new TypeError('Failed to fetch'))).toBe(false)
  })
})
