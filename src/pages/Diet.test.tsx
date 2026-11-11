import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { StoreProvider } from '../store'
import Diet from './Diet'

test('Diet page renders', () => {
  render(
    <MemoryRouter>
      <StoreProvider>
        <Diet />
      </StoreProvider>
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'Diet' })).toBeDefined()
})
