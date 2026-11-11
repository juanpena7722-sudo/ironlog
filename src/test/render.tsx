import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { createQueryClient } from '../api/auth'

export function renderWithProviders(ui: ReactNode, path = '/') {
  const queryClient = createQueryClient(false)
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
  return queryClient
}

export function renderApp(path: string) {
  return renderWithProviders(<App />, path)
}
