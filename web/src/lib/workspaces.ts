import { useMutation, useQuery } from '@tanstack/react-query'
import { del, get, patch, post } from './api'
import { rootClient } from './queryClient'
import type { WorkspaceInfo } from './types'
import { useWorkspace } from './workspace'

/**
 * The user's workspaces, in order. They live in the root client (not a
 * workspace's), because the nav and Settings list all of them. auth/me,
 * login and sign-up seed the list; these hooks keep it in step.
 */
export const workspacesKey = ['workspaces'] as const

export function useWorkspaces() {
  return useQuery(
    {
      queryKey: workspacesKey,
      queryFn: async () => (await get<{ data: WorkspaceInfo[] }>('/workspaces')).data,
      staleTime: Infinity,
    },
    rootClient
  )
}

/** The workspace the shell is in, from the list. */
export function useCurrentWorkspaceInfo(): WorkspaceInfo | undefined {
  const { workspace } = useWorkspace()
  return useWorkspaces().data?.find((w) => w.id === workspace)
}

const setList = (fn: (list: WorkspaceInfo[]) => WorkspaceInfo[]) =>
  rootClient.setQueryData<WorkspaceInfo[]>(workspacesKey, (old) => fn(old ?? []))

/** Keep the list's ai_enabled in step after Settings changes it. */
export function patchWorkspaceInList(id: number, change: Partial<WorkspaceInfo>) {
  setList((list) => list.map((w) => (w.id === id ? { ...w, ...change } : w)))
}

/** POST /workspaces { name }: added at the bottom, AI off. */
export function useCreateWorkspace() {
  return useMutation(
    {
      mutationFn: (name: string) => post<WorkspaceInfo>('/workspaces', { name }),
      onSuccess: (ws) => setList((list) => [...list.filter((w) => w.id !== ws.id), ws]),
    },
    rootClient
  )
}

export function useRenameWorkspace() {
  return useMutation(
    {
      mutationFn: ({ id, name }: { id: number; name: string }) =>
        patch<WorkspaceInfo>(`/workspaces/${id}`, { name }),
      onMutate: ({ id, name }) => {
        const before = rootClient.getQueryData<WorkspaceInfo[]>(workspacesKey)
        patchWorkspaceInList(id, { name })
        return { before }
      },
      onError: (_e, _v, ctx) => {
        if (ctx?.before) rootClient.setQueryData(workspacesKey, ctx.before)
      },
    },
    rootClient
  )
}

/** Drag to reorder: `ids` is the new order, `id` the moved one. */
export function useMoveWorkspace() {
  return useMutation(
    {
      mutationFn: ({ id, ids }: { id: number; ids: number[] }) => {
        const at = ids.indexOf(id)
        const body = at > 0 ? { after_id: ids[at - 1] } : { before_id: ids[1] }
        return patch<WorkspaceInfo>(`/workspaces/${id}`, body)
      },
      onMutate: ({ ids }) => {
        const before = rootClient.getQueryData<WorkspaceInfo[]>(workspacesKey)
        setList((list) => ids.map((id) => list.find((w) => w.id === id)!).filter(Boolean))
        return { before }
      },
      onSuccess: (ws) => patchWorkspaceInList(ws.id, { position: ws.position }),
      onError: (_e, _v, ctx) => {
        if (ctx?.before) rootClient.setQueryData(workspacesKey, ctx.before)
      },
    },
    rootClient
  )
}

/** DELETE /workspaces/:id: everything in it is gone for good. Not optimistic. */
export function useDeleteWorkspace() {
  return useMutation(
    {
      mutationFn: (id: number) => del(`/workspaces/${id}`),
      onSuccess: (_r, id) => setList((list) => list.filter((w) => w.id !== id)),
    },
    rootClient
  )
}
