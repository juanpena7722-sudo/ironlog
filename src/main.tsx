import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import { StoreProvider } from './store'
import { shouldRetry } from './api/client'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: shouldRetry } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <StoreProvider>
          <App />
        </StoreProvider>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
)
