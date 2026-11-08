import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import argon2 from 'argon2'
import { z } from 'zod'
import { Prisma } from './generated/prisma/client.js'
import type { Env } from './env.js'

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest) => Promise<void>
  }
  interface FastifyRequest {
    userId: string
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string }
  }
}

const SESSION_COOKIE = 'session'
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/api/v1',
} as const
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const RATE_LIMIT = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }
const INVALID_CREDENTIALS = 'Invalid email or password'
const DEFAULT_GOALS = {
  unit: 'kg',
  calories: 2800,
  protein: 200,
  carbs: 320,
  fat: 80,
  targetWeight: 85,
  waterL: 4,
  sleepHours: 8,
} as const
const PUBLIC_USER = { id: true, email: true } as const

const EMAIL_SCHEMA = z.string().trim().toLowerCase().pipe(z.email().max(254))
const PASSWORD_SCHEMA = z.string().min(1).max(128)
const REGISTER_SCHEMA = z.object({ email: EMAIL_SCHEMA, password: z.string().min(10).max(128) })
const LOGIN_SCHEMA = z.object({ email: EMAIL_SCHEMA, password: PASSWORD_SCHEMA })
const DELETE_ACCOUNT_SCHEMA = z.object({ password: PASSWORD_SCHEMA })

// Verified when the email is unknown so login takes the same time either way.
const DUMMY_HASH = argon2.hash('not-a-real-password', { type: argon2.argon2id })

function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password).catch(() => false)
}

function isForeignOrigin(request: FastifyRequest): boolean {
  const origin = request.headers.origin
  return origin !== undefined && URL.parse(origin)?.host !== request.host
}

async function authRoutes(app: FastifyInstance) {
  function setSession(reply: FastifyReply, userId: string) {
    reply.setCookie(SESSION_COOKIE, app.jwt.sign({ sub: userId }), {
      ...COOKIE_OPTIONS,
      maxAge: SESSION_TTL_SECONDS,
    })
  }

  app.post('/register', RATE_LIMIT, async (request, reply) => {
    const { email, password } = REGISTER_SCHEMA.parse(request.body)
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id })
    try {
      const user = await app.db.user.create({
        data: { email, passwordHash, goals: { create: DEFAULT_GOALS } },
        select: PUBLIC_USER,
      })
      setSession(reply, user.id)
      return reply.status(201).send(user)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw app.httpErrors.conflict('Email already registered')
      }
      throw error
    }
  })

  app.post('/login', RATE_LIMIT, async (request, reply) => {
    const { email, password } = LOGIN_SCHEMA.parse(request.body)
    const user = await app.db.user.findUnique({ where: { email } })
    const isValid = await verifyPassword(user?.passwordHash ?? (await DUMMY_HASH), password)
    if (!user || !isValid) throw app.httpErrors.unauthorized(INVALID_CREDENTIALS)
    setSession(reply, user.id)
    return { id: user.id, email: user.email }
  })

  app.post('/logout', RATE_LIMIT, async (_request, reply) =>
    reply.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS).status(204).send(),
  )

  app.get('/me', { ...RATE_LIMIT, preHandler: app.requireAuth }, async (request) => {
    const user = await app.db.user.findUnique({
      where: { id: request.userId },
      select: PUBLIC_USER,
    })
    if (!user) throw app.httpErrors.unauthorized('Not authenticated')
    return user
  })

  app.delete('/account', { ...RATE_LIMIT, preHandler: app.requireAuth }, async (request, reply) => {
    const { password } = DELETE_ACCOUNT_SCHEMA.parse(request.body)
    const user = await app.db.user.findUnique({ where: { id: request.userId } })
    if (!user) throw app.httpErrors.unauthorized('Not authenticated')
    if (!(await verifyPassword(user.passwordHash, password))) {
      throw app.httpErrors.unauthorized('Invalid password')
    }
    await app.db.user.delete({ where: { id: user.id } })
    return reply.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS).status(204).send()
  })
}

export function registerAuth(app: FastifyInstance, env: Env): void {
  app.register(cookie)
  app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: SESSION_COOKIE, signed: false },
    sign: { algorithm: 'HS256', expiresIn: SESSION_TTL_SECONDS },
    verify: { algorithms: ['HS256'], onlyCookie: true },
  })
  app.register(rateLimit, { global: false })

  app.decorateRequest('userId', '')
  app.decorate('requireAuth', async (request: FastifyRequest) => {
    try {
      request.userId = (await request.jwtVerify<{ sub: string }>()).sub
    } catch {
      throw app.httpErrors.unauthorized('Not authenticated')
    }
  })

  app.addHook('onRequest', async (request) => {
    if (!SAFE_METHODS.has(request.method) && isForeignOrigin(request)) {
      throw app.httpErrors.forbidden('Cross-origin request rejected')
    }
  })

  app.register(authRoutes, { prefix: '/api/v1/auth' })
}
