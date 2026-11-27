import { createContext, useContext } from 'react'
import { QueryClient } from '@tanstack/react-query'

/**
 * Workspaces (WORK-MODE.md, now any number: Personal and Work to start).
 * Each has its own goals, projects, to-dos, notes and AI setting. The API
 * picks it from the X-Focus-Workspace header, which carries the id
 * (api.ts reads `currentWorkspace()`). The list itself is in workspaces.ts.
 *
 * Every workspace gets its own QueryClient, so every query key is per
 * workspace without spelling it out, and the caches stay warm across a
 * switch. The root client (auth, the workspace list) lives in queryClient.ts.
 */
export type Workspace = number

/** null before sign-in: the API then picks the default workspace. */
let current: Workspace | null = null
export const currentWorkspace = () => current
export const setCurrentWorkspace = (ws: Workspace) => {
  current = ws
}

const clients = new Map<Workspace, QueryClient>()

/** A deleted workspace: forget its cache. */
export function dropWorkspaceClient(ws: Workspace) {
  clients.get(ws)?.clear()
  clients.delete(ws)
}

export function workspaceClient(ws: Workspace): QueryClient {
  let client = clients.get(ws)
  if (!client) {
    client = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } })
    clients.set(ws, client)
  }
  return client
}

/** Sign-out: forget everything cached for every workspace. */
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
  switchTo: (ws: Workspace) => Promise<void>
  /** Delete a workspace and everything in it (switches away first if it's open). */
  remove: (ws: Workspace) => Promise<void>
}

export const WorkspaceContext = createContext<WorkspaceState>({
  workspace: 0,
  switching: false,
  switchTo: async () => {},
  remove: async () => {},
})

export const useWorkspace = () => useContext(WorkspaceContext)
