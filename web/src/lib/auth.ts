import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, get, patch, post } from './api'
import { rootClient } from './queryClient'
import type { WorkspaceInfo } from './types'
import { clearWorkspaceClients } from './workspace'
import { workspacesKey } from './workspaces'
import { flushPendingDeletes } from './pendingDeletes'

export type User = {
  id: number
  email: string
  display_name: string | null
  /** Default length of the nav-bar timer, 1–180. */
  timer_minutes: number
  /** The workspace the app opens in next time (null: the first). */
  last_workspace_id: number | null
}

type MeResponse = { user: User; workspaces: WorkspaceInfo[] }

export const meKey = ['me'] as const

/** The signed-in user, or null when signed out. */
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async () => {
      try {
        const me = await get<MeResponse>('/auth/me')
        rootClient.setQueryData(workspacesKey, me.workspaces)
        return me.user
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: Infinity,
    retry: false,
  })
}

/** Signed in: the root client knows, and every workspace starts clean. */
function signedIn({ user, workspaces }: MeResponse) {
  clearWorkspaceClients()
  rootClient.setQueryData(workspacesKey, workspaces)
  rootClient.setQueryData(meKey, user)
}

export function useLogin() {
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      post<MeResponse>('/auth/login', input),
    onSuccess: signedIn,
  })
}

/** POST /auth/signup: a new account (with Personal and Work), signed in. */
export function useSignup() {
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) =>
      post<MeResponse>('/auth/signup', input),
    onSuccess: signedIn,
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      // Deletes waiting on their Undo go through before the session ends.
      await flushPendingDeletes()
      return post('/auth/logout')
    },
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
