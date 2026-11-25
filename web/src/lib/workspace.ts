import { createContext, useContext } from 'react'
import { QueryClient } from '@tanstack/react-query'

/**
 * Personal / Work (WORK-MODE.md). Each workspace has its own goals,
 * projects, to-dos, notes and AI setting. The API picks it from the
 * X-Focus-Workspace header (api.ts reads `currentWorkspace()`).
 *
 * Every workspace gets its own QueryClient, so every query key is per
 * workspace without spelling it out, and both caches stay warm across a
 * switch. The root client (auth) lives in queryClient.ts.
 */
export type Workspace = 'personal' | 'work'
export const WORKSPACES: Workspace[] = ['personal', 'work']
export const WORKSPACE_LABEL: Record<Workspace, string> = { personal: 'Personal', work: 'Work' }

let current: Workspace = 'personal'
export const currentWorkspace = () => current
export const setCurrentWorkspace = (ws: Workspace) => {
  current = ws
}

const clients = new Map<Workspace, QueryClient>()

export function workspaceClient(ws: Workspace): QueryClient {
  let client = clients.get(ws)
  if (!client) {
    client = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } })
    clients.set(ws, client)
  }
  return client
}

/** Sign-out: forget everything cached for both workspaces. */
export function clearWorkspaceClients() {
  for (const client of clients.values()) client.clear()
}

/** Resolves once nothing is being saved, so no request goes out under the wrong header. */
export function whenIdle(client: QueryClient, timeoutMs = 8000): Promise<void> {
  if (client.isMutating() === 0) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      unsubscribe()
      window.clearTimeout(timer)
      resolve()
    }
    const unsubscribe = client.getMutationCache().subscribe(() => {
      if (client.isMutating() === 0) done()
    })
    const timer = window.setTimeout(done, timeoutMs)
  })
}

export type WorkspaceState = {
  workspace: Workspace
  switching: boolean
  switchTo: (ws: Workspace) => void
}

export const WorkspaceContext = createContext<WorkspaceState>({
  workspace: 'personal',
  switching: false,
  switchTo: () => {},
})

export const useWorkspace = () => useContext(WorkspaceContext)
