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
  server: {
    proxy: {
      // The string shorthand sets changeOrigin, so the API would see a Host that differs from Origin.
      '/api': { target: 'http://localhost:3000' },
    },
  },
  test: {
    include: ['shared/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['shared/**/*.ts', 'src/utils.ts', 'src/units.ts', 'src/api/**/*.ts'],
      exclude: ['**/*.test.ts'],
      thresholds: {
        lines: 80,
        branches: 75,
        'shared/**': { lines: 90, branches: 85 },
        'src/utils.ts': { lines: 90, branches: 85 },
        'src/units.ts': { lines: 90, branches: 85 },
        'src/api/**': { lines: 90, branches: 85 },
      },
    },
  },
})
