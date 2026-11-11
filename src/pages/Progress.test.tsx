import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { StoreProvider } from '../store'
import Progress from './Progress'

test('Progress page renders', () => {
  render(
    <MemoryRouter>
      <StoreProvider>
        <Progress />
      </StoreProvider>
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'Progress' })).toBeDefined()
})
