import { z } from 'zod'
import { ISODateSchema } from '../../shared/schemas.js'

const DAY_MS = 24 * 60 * 60 * 1000

const LIST_QUERY_SCHEMA = z.object({
  from: ISODateSchema.optional(),
  to: ISODateSchema.optional(),
})

export const ID_PARAMS_SCHEMA = z.object({ id: z.uuid() })

export function toISODate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function parseDateRange(query: unknown, defaultDays: number) {
  const { from, to } = LIST_QUERY_SCHEMA.parse(query)
  const defaultFrom = toISODate(new Date(Date.now() - defaultDays * DAY_MS))
  return { gte: new Date(from ?? defaultFrom), lte: to ? new Date(to) : undefined }
}
