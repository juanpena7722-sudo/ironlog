import type { FastifyInstance } from 'fastify'
import { GoalsSchema, type Goals } from '../../shared/schemas.js'
import type { Goals as GoalsRow } from './generated/prisma/client.js'
import { DEFAULT_GOALS } from './auth.js'

export function toGoals(row: GoalsRow): Goals {
  return {
    unit: row.unit,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    targetWeight: row.targetWeight.toNumber(),
    waterL: row.waterL,
    sleepHours: row.sleepHours,
  }
}

export async function goalsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth)

  app.get('/', async (request): Promise<Goals> => {
    const row = await app.db.goals.findUnique({ where: { userId: request.userId } })
    return row ? toGoals(row) : DEFAULT_GOALS
  })

  app.put('/', async (request) => {
    const data = GoalsSchema.parse(request.body)
    const row = await app.db.goals.upsert({
      where: { userId: request.userId },
      create: { userId: request.userId, ...data },
      update: data,
    })
    return toGoals(row)
  })
}
