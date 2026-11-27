import { useCallback, useMemo, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { patch } from './lib/api'
import { meKey, useMe, type User } from './lib/auth'
import {
  dropWorkspaceClient,
  setCurrentWorkspace,
  whenIdle,
  workspaceClient,
  WorkspaceContext,
  type Workspace,
} from './lib/workspace'
import { settingsKey } from './lib/settings'
import { useDeleteWorkspace, useWorkspaces } from './lib/workspaces'
import { flushPendingDeletes } from './lib/pendingDeletes'
import Shell from './components/Shell'
import Login from './pages/Login'
import Todos from './pages/Todos'
import Goals from './pages/Goals'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Settings from './pages/Settings'
import Calendar from './pages/Calendar'
import Notes from './pages/Notes'

function RequireAuth() {
  const { data: user, isPending, isError } = useMe()
  const workspaces = useWorkspaces()
  const location = useLocation()
  if (isPending || (user && !workspaces.data?.length)) return null
  if (isError) return <p className="shell-main muted">Can't reach the server.</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <WorkspaceShell user={user} />
}

/**
 * Workspaces (WORK-MODE.md, any number). Each has its own query client; the
 * shell is keyed by workspace, so switching resets every bit of local UI
 * state (open rows, searches, inputs) and swaps every query at once.
 */
function WorkspaceShell({ user }: { user: User }) {
  const { data: list = [] } = useWorkspaces()
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    const ws = list.find((w) => w.id === user.last_workspace_id)?.id ?? list[0]?.id ?? 0
    setCurrentWorkspace(ws)
    return ws
  })
  const [switching, setSwitching] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const deleteWorkspace = useDeleteWorkspace()

  const client = workspaceClient(workspace)
  // The signed-in user is shared: seed it so the shell doesn't refetch it.
  if (client.getQueryData(meKey) === undefined) client.setQueryData(meKey, user)

  const switchTo = useCallback(
    async (next: Workspace) => {
      if (next === workspace || switching) return
      setSwitching(true)
      const from = workspaceClient(workspace)
      // Deletes waiting on their Undo go through now, then pending saves
      // finish, all under the old header.
      await flushPendingDeletes()
      await whenIdle(from)
      const to = workspaceClient(next)
      to.setQueryData(meKey, from.getQueryData(meKey) ?? user)
      // User-level settings (limit, timer) may have changed in the other one.
      to.invalidateQueries({ queryKey: settingsKey })
      setCurrentWorkspace(next)
      setWorkspace(next)
      setSwitching(false)
      // An open project belongs to the other workspace.
      if (location.pathname.startsWith('/projects/')) navigate('/projects')
      patch('/settings', { last_workspace_id: next }).catch(() => {})
    },
    [workspace, switching, user, location.pathname, navigate]
  )

  /** Delete a workspace (never the last one); leave it first if it's open. */
  const remove = useCallback(
    async (id: Workspace) => {
      if (id === workspace) {
        const other = list.find((w) => w.id !== id)
        if (!other) return
        await switchTo(other.id)
      }
      await deleteWorkspace.mutateAsync(id)
      dropWorkspaceClient(id)
    },
    [workspace, list, switchTo, deleteWorkspace]
  )

  const value = useMemo(
    () => ({ workspace, switching, switchTo, remove }),
    [workspace, switching, switchTo, remove]
  )

  return (
    <WorkspaceContext.Provider value={value}>
      <QueryClientProvider client={client}>
        <Shell key={workspace}>
          <Outlet />
        </Shell>
      </QueryClientProvider>
    </WorkspaceContext.Provider>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Navigate to="/goals" replace />} />
        <Route path="/todos" element={<Todos />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/goals" replace />} />
    </Routes>
  )
}
