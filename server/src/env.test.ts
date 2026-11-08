import { describe, expect, it } from 'vitest'
import { parseEnv } from './env.js'

const VALID_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://ironlog:ironlog@localhost:5432/ironlog_test',
  JWT_SECRET: 'a'.repeat(32),
}

describe('parseEnv', () => {
  it('parses a valid env and defaults PORT to 3000', () => {
    expect(parseEnv(VALID_ENV)).toEqual({ ...VALID_ENV, PORT: 3000 })
  })

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(() => parseEnv({ ...VALID_ENV, JWT_SECRET: 'a'.repeat(31) })).toThrow(/JWT_SECRET/)
  })
})
