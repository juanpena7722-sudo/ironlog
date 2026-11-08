import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { FoodEntrySchema, type FoodEntry } from '../../shared/schemas.js'
import type { FoodEntry as FoodEntryRow } from './generated/prisma/client.js'
import { ID_PARAMS_SCHEMA, parseDateRange, toISODate } from './routes.js'

const DEFAULT_RANGE_DAYS = 30
const RECENT_BATCH_SIZE = 100

const FOOD_INPUT_SCHEMA = FoodEntrySchema.omit({ id: true })
const RECENT_QUERY_SCHEMA = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

type FoodInput = z.infer<typeof FOOD_INPUT_SCHEMA>

function toFoodEntry(row: FoodEntryRow): FoodEntry {
  return {
    id: row.id,
    date: toISODate(row.date),
    meal: row.meal,
    name: row.name,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
  }
}

function toFoodData(input: FoodInput) {
  return { ...input, date: new Date(input.date) }
}

export async function foodRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth)

  function notFound() {
    return app.httpErrors.notFound('Food entry not found')
  }

  app.get('/', async (request) => {
    const date = parseDateRange(request.query, DEFAULT_RANGE_DAYS)
    const rows = await app.db.foodEntry.findMany({
      where: { userId: request.userId, date },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })
    return rows.map(toFoodEntry)
  })

  app.get('/recent', async (request) => {
    const { limit } = RECENT_QUERY_SCHEMA.parse(request.query)
    const recent = new Map<string, FoodEntry>()
    for (let skip = 0; recent.size < limit; skip += RECENT_BATCH_SIZE) {
      const rows = await app.db.foodEntry.findMany({
        where: { userId: request.userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: RECENT_BATCH_SIZE,
      })
      for (const row of rows) {
        const key = row.name.toLowerCase()
        if (recent.size < limit && !recent.has(key)) recent.set(key, toFoodEntry(row))
      }
      if (rows.length < RECENT_BATCH_SIZE) break
    }
    return [...recent.values()]
  })

  app.post('/', async (request, reply) => {
    const input = FOOD_INPUT_SCHEMA.parse(request.body)
    const row = await app.db.foodEntry.create({
      data: { userId: request.userId, ...toFoodData(input) },
    })
    return reply.status(201).send(toFoodEntry(row))
  })

  app.put('/:id', async (request) => {
    const { id } = ID_PARAMS_SCHEMA.parse(request.params)
    const input = FOOD_INPUT_SCHEMA.parse(request.body)
    const { count } = await app.db.foodEntry.updateMany({
      where: { id, userId: request.userId },
      data: toFoodData(input),
    })
    if (count === 0) throw notFound()
    return { id, ...input }
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = ID_PARAMS_SCHEMA.parse(request.params)
    const { count } = await app.db.foodEntry.deleteMany({ where: { id, userId: request.userId } })
    if (count === 0) throw notFound()
    return reply.status(204).send()
  })
}
