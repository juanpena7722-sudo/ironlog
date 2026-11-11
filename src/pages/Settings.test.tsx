import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { StoreProvider } from '../store'
import Settings from './Settings'

test('Settings page renders', () => {
  render(
    <MemoryRouter>
      <StoreProvider>
        <Settings />
      </StoreProvider>
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeDefined()
})
