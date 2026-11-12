import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'

const HEALTH_URL = 'http://localhost/api/v1/health'
const HEALTH_TIMEOUT_MS = 120_000
const COMPOSE = ['compose', '-f', 'docker-compose.prod.yml']

const run = (command: string, args: string[], env: NodeJS.ProcessEnv) =>
  execFileSync(command, args, { stdio: 'inherit', env })

async function waitForHealth() {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS
  while (Date.now() < deadline) {
    const response = await fetch(HEALTH_URL).catch(() => null)
    if (response?.ok) return
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`${HEALTH_URL} did not become healthy`)
}

// Builds dist, starts the production stack with throwaway secrets, and returns its teardown.
export default async function globalSetup() {
  const env = {
    ...process.env,
    POSTGRES_PASSWORD: randomBytes(24).toString('hex'),
    JWT_SECRET: randomBytes(32).toString('hex'),
    SITE_ADDRESS: ':80',
  }
  const teardown = () => run('docker', [...COMPOSE, 'down', '-v'], env)
  try {
    run('npm', ['run', 'build'], env)
    run('docker', [...COMPOSE, 'up', '-d', '--build'], env)
    await waitForHealth()
  } catch (error) {
    teardown()
    throw error
  }
  return teardown
}
