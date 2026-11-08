import type { PrismaClient } from '../generated/prisma/client.js'
import type { Env } from '../env.js'

export const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 3000,
  DATABASE_URL: 'postgresql://ironlog:ironlog@localhost:5432/ironlog_test',
  JWT_SECRET: 'a'.repeat(32),
}

export async function truncateTables(db: PrismaClient): Promise<void> {
  await db.$executeRaw`TRUNCATE TABLE "User" CASCADE`
}
