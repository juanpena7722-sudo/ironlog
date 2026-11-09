import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { HealthEntrySchema, ISODateSchema, type HealthEntry } from '../../shared/schemas.js'
import type { HealthEntry as HealthEntryRow } from './generated/prisma/client.js'
import { parseDateRange, toISODate } from './routes.js'

const DEFAULT_RANGE_DAYS = 30

const HEALTH_INPUT_SCHEMA = HealthEntrySchema.omit({ id: true, date: true })
const DATE_PARAMS_SCHEMA = z.object({ date: ISODateSchema })

function toHealthEntry(row: HealthEntryRow): HealthEntry {
  return {
    id: row.id,
    date: toISODate(row.date),
    sleepHours: row.sleepHours ?? undefined,
    waterL: row.waterL ?? undefined,
    restingHR: row.restingHR ?? undefined,
    steps: row.steps ?? undefined,
    energy: row.energy ?? undefined,
    notes: row.notes ?? undefined,
  }
}

export async function healthRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth)

  app.get('/', async (request) => {
    const date = parseDateRange(request.query, DEFAULT_RANGE_DAYS)
    const rows = await app.db.healthEntry.findMany({
      where: { userId: request.userId, date },
      orderBy: { date: 'desc' },
    })
    return rows.map(toHealthEntry)
  })

  app.put('/:date', async (request) => {
    const date = new Date(DATE_PARAMS_SCHEMA.parse(request.params).date)
    const input = HEALTH_INPUT_SCHEMA.parse(request.body)
    const data = {
      sleepHours: input.sleepHours ?? null,
      waterL: input.waterL ?? null,
      restingHR: input.restingHR ?? null,
      steps: input.steps ?? null,
      energy: input.energy ?? null,
      notes: input.notes ?? null,
    }
    const row = await app.db.healthEntry.upsert({
      where: { userId_date: { userId: request.userId, date } },
      create: { userId: request.userId, date, ...data },
      update: data,
    })
    return toHealthEntry(row)
  })

  app.delete('/:date', async (request, reply) => {
    const date = new Date(DATE_PARAMS_SCHEMA.parse(request.params).date)
    const { count } = await app.db.healthEntry.deleteMany({
      where: { userId: request.userId, date },
    })
    if (count === 0) throw app.httpErrors.notFound('Health entry not found')
    return reply.status(204).send()
  })
}
