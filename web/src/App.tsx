import { useCallback, useMemo, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { patch } from './lib/api'
import { meKey, useMe, type User } from './lib/auth'
import {
  setCurrentWorkspace,
  whenIdle,
  workspaceClient,
  WorkspaceContext,
  type Workspace,
} from './lib/workspace'
import { settingsKey } from './lib/settings'
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
  const location = useLocation()
  if (isPending) return null
  if (isError) return <p className="shell-main muted">Can't reach the server.</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <WorkspaceShell user={user} />
}

/**
 * Personal / Work (WORK-MODE.md). Each workspace has its own query client;
 * the shell is keyed by workspace, so switching resets every bit of local
 * UI state (open rows, searches, inputs) and swaps every query at once.
 */
function WorkspaceShell({ user }: { user: User }) {
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    const ws = user.last_workspace === 'work' ? 'work' : 'personal'
    setCurrentWorkspace(ws)
    return ws
  })
  const [switching, setSwitching] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const client = workspaceClient(workspace)
  // The signed-in user is shared: seed it so the shell doesn't refetch it.
  if (client.getQueryData(meKey) === undefined) client.setQueryData(meKey, user)

  const switchTo = useCallback(
    async (next: Workspace) => {
      if (next === workspace || switching) return
      setSwitching(true)
      const from = workspaceClient(workspace)
      // Let pending saves finish under the old header first.
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
      patch('/settings', { last_workspace: next }).catch(() => {})
    },
    [workspace, switching, user, location.pathname, navigate]
  )

  const value = useMemo(() => ({ workspace, switching, switchTo }), [workspace, switching, switchTo])

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
