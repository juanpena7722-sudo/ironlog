import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { StoreProvider } from '../store'
import Health from './Health'

test('Health page renders', () => {
  render(
    <MemoryRouter>
      <StoreProvider>
        <Health />
      </StoreProvider>
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'Health' })).toBeDefined()
})
