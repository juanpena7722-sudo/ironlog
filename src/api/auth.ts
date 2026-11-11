import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { UserSchema } from '@shared/schemas'
import type { Credentials } from '@shared/schemas'
import { ApiError, apiRequest } from './client'

export const SESSION_KEY = ['session']

async function fetchSession() {
  try {
    return await apiRequest('/auth/me', UserSchema)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export function useSession() {
  return useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession, staleTime: Infinity })
}

export function useSignIn(mode: 'login' | 'register') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentials: Credentials) =>
      apiRequest(`/auth/${mode}`, UserSchema, jsonRequest('POST', credentials)),
    onSuccess: (user) => queryClient.setQueryData(SESSION_KEY, user),
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
    onSuccess: endSession,
  })
}

export function errorMessage(error: Error): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
}
