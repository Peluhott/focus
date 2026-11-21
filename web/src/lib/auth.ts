import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, get, post } from './api'

export type User = {
  id: number
  email: string
  focus_limit: 3 | 5 | 7
  ai_enabled: boolean
}

export const meKey = ['me'] as const

/** The signed-in user, or null when signed out. */
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async () => {
      try {
        return (await get<{ user: User }>('/auth/me')).user
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: Infinity,
    retry: false,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      post<{ user: User }>('/auth/login', input),
    onSuccess: ({ user }) => qc.setQueryData(meKey, user),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => post('/auth/logout'),
    onSettled: () => {
      qc.clear()
      qc.setQueryData(meKey, null)
    },
  })
}
