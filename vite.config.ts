import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    include: ['shared/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['shared/**/*.ts', 'src/utils.ts'],
      exclude: ['**/*.test.ts'],
      thresholds: {
        lines: 80,
        branches: 75,
        'shared/**': { lines: 90, branches: 85 },
        'src/utils.ts': { lines: 90, branches: 85 },
      },
    },
  },
})
