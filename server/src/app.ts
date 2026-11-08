import { STATUS_CODES } from 'node:http'
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { createDb } from './db.js'
import type { Env } from './env.js'

type FieldError = { path: string; message: string }

function sendProblem(reply: FastifyReply, status: number, detail: string, errors?: FieldError[]) {
  return reply
    .status(status)
    .type('application/problem+json')
    .send({ type: 'about:blank', title: STATUS_CODES[status], status, detail, errors })
}

export function buildApp(env: Env): FastifyInstance {
  const app = Fastify({ logger: { level: env.NODE_ENV === 'test' ? 'silent' : 'info' } })

  app.register(sensible)

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

  app.get('/api/v1/health', async () => ({ status: 'ok' }))

  return app
}
