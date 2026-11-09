import type { FastifyInstance } from 'fastify'
import type { z } from 'zod'
import { BodyEntrySchema, type BodyEntry } from '../../shared/schemas.js'
import type { BodyEntry as BodyEntryRow } from './generated/prisma/client.js'
import { ID_PARAMS_SCHEMA, parseDateRange, toISODate } from './routes.js'

const DEFAULT_RANGE_DAYS = 90

const BODY_INPUT_SCHEMA = BodyEntrySchema.omit({ id: true })

type BodyInput = z.infer<typeof BODY_INPUT_SCHEMA>

function toBodyEntry(row: BodyEntryRow): BodyEntry {
  return {
    id: row.id,
    date: toISODate(row.date),
    weight: row.weight.toNumber(),
    bodyFat: row.bodyFat ?? undefined,
    chest: row.chest?.toNumber(),
    waist: row.waist?.toNumber(),
    arms: row.arms?.toNumber(),
    thighs: row.thighs?.toNumber(),
  }
}

function toBodyData(input: BodyInput) {
  return {
    date: new Date(input.date),
    weight: input.weight,
    bodyFat: input.bodyFat ?? null,
    chest: input.chest ?? null,
    waist: input.waist ?? null,
    arms: input.arms ?? null,
    thighs: input.thighs ?? null,
  }
}

export async function bodyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth)

  function notFound() {
    return app.httpErrors.notFound('Body entry not found')
  }

  app.get('/', async (request) => {
    const date = parseDateRange(request.query, DEFAULT_RANGE_DAYS)
    const rows = await app.db.bodyEntry.findMany({
      where: { userId: request.userId, date },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })
    return rows.map(toBodyEntry)
  })

  app.post('/', async (request, reply) => {
    const input = BODY_INPUT_SCHEMA.parse(request.body)
    const row = await app.db.bodyEntry.create({
      data: { userId: request.userId, ...toBodyData(input) },
    })
    return reply.status(201).send(toBodyEntry(row))
  })

  app.put('/:id', async (request) => {
    const { id } = ID_PARAMS_SCHEMA.parse(request.params)
    const input = BODY_INPUT_SCHEMA.parse(request.body)
    const [row] = await app.db.bodyEntry.updateManyAndReturn({
      where: { id, userId: request.userId },
      data: toBodyData(input),
    })
    if (!row) throw notFound()
    return toBodyEntry(row)
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = ID_PARAMS_SCHEMA.parse(request.params)
    const { count } = await app.db.bodyEntry.deleteMany({ where: { id, userId: request.userId } })
    if (count === 0) throw notFound()
    return reply.status(204).send()
  })
}
