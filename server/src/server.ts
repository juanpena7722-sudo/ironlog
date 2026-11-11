import { buildApp } from './app.js'
import { parseEnv } from './env.js'

const env = parseEnv(process.env)
const app = buildApp(env)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => app.close())
}

// In production the API runs in a container on a private network behind the gateway.
const host = env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'
await app.listen({ host, port: env.PORT })
