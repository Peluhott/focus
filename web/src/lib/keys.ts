import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { del, get, post } from './api'
import type { ApiKey } from './types'

/** API keys (spec "REST API and API keys"). Session only on the server. */

export const keysKey = ['keys'] as const

export const API_SCOPES = [
  'goals:read',
  'goals:write',
  'projects:read',
  'projects:write',
  'todos:read',
  'todos:write',
  'notes:read',
  'notes:write',
] as const

export function useApiKeys() {
  return useQuery({ queryKey: keysKey, queryFn: () => get<{ data: ApiKey[] }>('/keys') })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; scopes: string[]; expires_on: string | null }) =>
      post<ApiKey>('/keys', input),
    onSettled: () => qc.invalidateQueries({ queryKey: keysKey }),
  })
}

export function useRevokeApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => del(`/keys/${id}`),
    onSettled: () => qc.invalidateQueries({ queryKey: keysKey }),
  })
}
