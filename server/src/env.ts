import { z } from 'zod'

const ENV_SCHEMA = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32),
})

export type Env = z.infer<typeof ENV_SCHEMA>

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return ENV_SCHEMA.parse(source)
}
