import { http, HttpResponse } from 'msw'
import type { Goals } from '@shared/schemas'
import { server } from './setup'

export type RecordedRequest = { method: string; url: URL; body: unknown }

/** In-memory REST collection under /api/v1/<path>, keyed by `id` (or `date` for health entries). */
export function mockCollection<T extends { id: string; date: string }>(
  path: string,
  initial: T[],
  key: 'id' | 'date' = 'id',
) {
  let items = [...initial]
  const requests: RecordedRequest[] = []
  const record = async (request: globalThis.Request) => {
    const body: unknown = request.method === 'DELETE' ? undefined : await request.json()
    requests.push({ method: request.method, url: new URL(request.url), body })
    return body as T
  }
  server.use(
    http.get(`/api/v1/${path}`, ({ request }) => {
      const url = new URL(request.url)
      requests.push({ method: 'GET', url, body: undefined })
      const from = url.searchParams.get('from') ?? ''
      const to = url.searchParams.get('to') ?? '9999-12-31'
      return HttpResponse.json(items.filter((item) => item.date >= from && item.date <= to))
    }),
    http.post(`/api/v1/${path}`, async ({ request }) => {
      const item = { ...(await record(request)), id: crypto.randomUUID() }
      items = [item, ...items]
      return HttpResponse.json(item, { status: 201 })
    }),
    http.put(`/api/v1/${path}/:key`, async ({ request, params }) => {
      const body = await record(request)
      const old = items.find((item) => item[key] === params.key)
      const item = { ...body, [key]: params.key, id: old?.id ?? crypto.randomUUID() } as T
      items = old ? items.map((x) => (x === old ? item : x)) : [item, ...items]
      return HttpResponse.json(item)
    }),
    http.delete(`/api/v1/${path}/:key`, async ({ request, params }) => {
      await record(request)
      items = items.filter((item) => item[key] !== params.key)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return { requests, items: () => items }
}

export function mockGoals(initial: Goals) {
  let goals = initial
  const saved: Goals[] = []
  server.use(
    http.get('/api/v1/goals', () => HttpResponse.json(goals)),
    http.put('/api/v1/goals', async ({ request }) => {
      goals = (await request.json()) as Goals
      saved.push(goals)
      return HttpResponse.json(goals)
    }),
  )
  return saved
}
