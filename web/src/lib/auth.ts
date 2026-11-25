import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, get, patch, post } from './api'
import { rootClient } from './queryClient'
import { clearWorkspaceClients, type Workspace } from './workspace'

export type User = {
  id: number
  email: string
  display_name: string | null
  focus_limit: 3 | 5 | 7
  /** Default length of the nav-bar timer, 1–180. */
  timer_minutes: number
  /** The workspace the app opens in next time. */
  last_workspace: Workspace
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

/** Signed in: the root client knows, and both workspaces start clean. */
function signedIn(user: User) {
  clearWorkspaceClients()
  rootClient.setQueryData(meKey, user)
}

export function useLogin() {
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      post<{ user: User }>('/auth/login', input),
    onSuccess: ({ user }) => signedIn(user),
  })
}

/** POST /auth/signup: a new account (with Personal and Work), signed in. */
export function useSignup() {
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) =>
      post<{ user: User }>('/auth/signup', input),
    onSuccess: ({ user }) => signedIn(user),
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: () => post('/auth/logout'),
    onSettled: () => {
      clearWorkspaceClients()
      rootClient.clear()
      rootClient.setQueryData(meKey, null)
    },
  })
}

export type AccountPatch = {
  display_name?: string
  email?: string
  current_password?: string
  new_password?: string
}

/** PATCH /account (SETTINGS.md §1). Not optimistic: the server checks the password. */
export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AccountPatch) => patch<{ user: User }>('/account', input),
    onSuccess: ({ user }) => {
      qc.setQueryData(meKey, user)
      rootClient.setQueryData(meKey, user)
    },
  })
}
