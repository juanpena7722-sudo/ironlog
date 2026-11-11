import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { StoreProvider } from '../store'
import Workouts from './Workouts'

test('Workouts page renders', () => {
  render(
    <MemoryRouter>
      <StoreProvider>
        <Workouts />
      </StoreProvider>
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'Workouts' })).toBeDefined()
})
