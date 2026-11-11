import {
  MutationCache,
  QueryCache,
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { UserSchema } from '@shared/schemas'
import type { Credentials } from '@shared/schemas'
import { ApiError, apiRequest, jsonRequest } from './client'

export const SESSION_KEY = ['session']

async function fetchSession() {
  try {
    return await apiRequest('/auth/me', UserSchema)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

// A page still mounted when the session ends can refill the cache, so sign-in clears it again.
function removeUserData(queryClient: QueryClient) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY[0] })
}

// Login and account deletion answer a wrong password with 401 while the session is still valid.
const CREDENTIAL_CHECK = { isCredentialCheck: true }

export function createQueryClient(
  retry: false | ((failureCount: number, error: Error) => boolean),
): QueryClient {
  const endExpiredSession = (error: Error) => {
    if (!(error instanceof ApiError) || error.status !== 401) return
    queryClient.setQueryData(SESSION_KEY, null)
    removeUserData(queryClient)
  }
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: endExpiredSession }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!mutation.meta?.isCredentialCheck) endExpiredSession(error)
      },
    }),
    defaultOptions: { queries: { retry } },
  })
  return queryClient
}

export function useSession() {
  return useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession, staleTime: Infinity })
}

export function useSignIn(mode: 'login' | 'register') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentials: Credentials) =>
      apiRequest(`/auth/${mode}`, UserSchema, jsonRequest('POST', credentials)),
    meta: CREDENTIAL_CHECK,
    onSuccess: (user) => {
      removeUserData(queryClient)
      queryClient.setQueryData(SESSION_KEY, user)
    },
  })
}

function useEndSession() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return () => {
    queryClient.getQueryCache().clear()
    queryClient.setQueryData(SESSION_KEY, null)
    navigate('/login', { replace: true })
  }
}

export function useLogout() {
  const endSession = useEndSession()
  return useMutation({
    mutationFn: () => apiRequest('/auth/logout', z.undefined(), { method: 'POST' }),
    onSuccess: endSession,
  })
}

export function useDeleteAccount() {
  const endSession = useEndSession()
  return useMutation({
    mutationFn: (password: string) =>
      apiRequest('/auth/account', z.undefined(), jsonRequest('DELETE', { password })),
    meta: CREDENTIAL_CHECK,
    onSuccess: endSession,
  })
}

export function errorMessage(error: Error): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
}
