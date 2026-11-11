import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import App from './App'
import { StoreProvider } from './store'

test.each([
  ['/', 'Dashboard'],
  ['/workouts', 'Workouts'],
  ['/diet', 'Diet'],
  ['/progress', 'Progress'],
  ['/health', 'Health'],
  ['/settings', 'Settings'],
])('route %s lazy-loads the %s page', async (path, name) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <StoreProvider>
        <App />
      </StoreProvider>
    </MemoryRouter>,
  )
  expect(screen.getByText('Loading…')).toBeDefined()
  expect(await screen.findByRole('heading', { level: 1, name })).toBeDefined()
})
