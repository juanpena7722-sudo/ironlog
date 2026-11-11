import { z } from 'zod'

const API_BASE = '/api/v1'

const ProblemDetailsSchema = z.object({
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
})

export class ApiError extends Error {
  readonly status: number
  readonly title: string
  readonly detail?: string

  constructor(status: number, title: string, detail?: string) {
    super(detail ?? title)
    this.name = 'ApiError'
    this.status = status
    this.title = title
    this.detail = detail
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null)
  const problem = ProblemDetailsSchema.safeParse(body)
  if (!problem.success) return new ApiError(response.status, response.statusText)
  return new ApiError(response.status, problem.data.title, problem.data.detail)
}

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, credentials: 'same-origin' })
  if (!response.ok) throw await toApiError(response)
  const text = await response.text()
  return schema.parse(text ? JSON.parse(text) : undefined)
}

export function jsonRequest(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export function shouldRetry(failureCount: number, error: Error): boolean {
  return failureCount < 1 && error instanceof ApiError && error.status >= 500
}
