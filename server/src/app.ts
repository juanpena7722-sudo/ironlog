import { STATUS_CODES } from 'node:http'
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply } from 'fastify'
import helmet from '@fastify/helmet'
import sensible from '@fastify/sensible'
import swagger from '@fastify/swagger'
import { ZodError } from 'zod'
import { registerAuth } from './auth.js'
import { backupRoutes } from './backup.js'
import { bodyRoutes } from './body.js'
import { createDb } from './db.js'
import { foodRoutes } from './foods.js'
import { goalsRoutes } from './goals.js'
import type { Env } from './env.js'
import { healthRoutes } from './health.js'
import { workoutRoutes } from './workouts.js'

type FieldError = { path: string; message: string }

function sendProblem(reply: FastifyReply, status: number, detail: string, errors?: FieldError[]) {
  return reply
    .status(status)
    .type('application/problem+json')
    .send({ type: 'about:blank', title: STATUS_CODES[status], status, detail, errors })
}

const LOG_REDACT_PATHS = [
  '*.headers.authorization',
  '*.headers.cookie',
  '*.headers["set-cookie"]',
  'password',
  '*.password',
]
const BODY_LIMIT = 100 * 1024

export function buildApp(env: Env, logStream?: { write(message: string): void }): FastifyInstance {
  const isSilent = env.NODE_ENV === 'test' && !logStream
  const isProduction = env.NODE_ENV === 'production'
  const app = Fastify({
    logger: { level: isSilent ? 'silent' : 'info', stream: logStream, redact: LOG_REDACT_PATHS },
    bodyLimit: BODY_LIMIT,
    // In production the API is only reachable through the gateway, which sets X-Forwarded-For.
    trustProxy: isProduction,
  })

  app.register(sensible)
  app.register(helmet)

  if (!isProduction) {
    app.register(swagger, { openapi: { info: { title: 'IronLog API', version: '1' } } })
    app.get('/docs', { schema: { hide: true } }, async () => app.swagger())
  }

  app.decorate('db', createDb(env.DATABASE_URL))
  app.addHook('onClose', () => app.db.$disconnect())

  app.setNotFoundHandler((request, reply) =>
    sendProblem(reply, 404, `Route ${request.method} ${request.url} not found`),
  )

  app.setErrorHandler<FastifyError | ZodError>((error, request, reply) => {
    if (error instanceof ZodError) {
      const errors = error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))
      return sendProblem(reply, 400, 'Invalid input', errors)
    }
    const status =
      error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500
    if (status < 500) return sendProblem(reply, status, error.message)
    request.log.error(error)
    const detail = env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
    return sendProblem(reply, status, detail)
  })

  registerAuth(app, env)

  app.register(async (api) => {
    api.get('/api/v1/health', async () => ({ status: 'ok' }))
  })
  app.register(workoutRoutes, { prefix: '/api/v1/workouts' })
  app.register(foodRoutes, { prefix: '/api/v1/foods' })
  app.register(bodyRoutes, { prefix: '/api/v1/body' })
  app.register(healthRoutes, { prefix: '/api/v1/health-entries' })
  app.register(goalsRoutes, { prefix: '/api/v1/goals' })
  app.register(backupRoutes, { prefix: '/api/v1/backup' })

  return app
}
