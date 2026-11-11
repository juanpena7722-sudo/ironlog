import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { StoreProvider } from '../store'
import Dashboard from './Dashboard'

test('Dashboard page renders', () => {
  render(
    <MemoryRouter>
      <StoreProvider>
        <Dashboard />
      </StoreProvider>
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined()
})
