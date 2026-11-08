import { buildApp } from './app.js'
import { parseEnv } from './env.js'

const env = parseEnv(process.env)
const app = buildApp(env)

await app.listen({ host: '127.0.0.1', port: env.PORT })
