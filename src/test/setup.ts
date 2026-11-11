import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { handlers } from './handlers'

// jsdom has no ResizeObserver; Recharts' ResponsiveContainer needs one.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

export const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  localStorage.clear()
})
afterAll(() => server.close())
