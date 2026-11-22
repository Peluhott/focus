import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useMe } from './lib/auth'
import Shell from './components/Shell'
import Login from './pages/Login'
import Todos from './pages/Todos'
import Goals from './pages/Goals'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Settings from './pages/Settings'
import Calendar from './pages/Calendar'

function RequireAuth() {
  const { data: user, isPending, isError } = useMe()
  const location = useLocation()
  if (isPending) return null
  if (isError) return <p className="shell-main muted">Can't reach the server.</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return (
    <Shell>
      <Outlet />
    </Shell>
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
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/goals" replace />} />
    </Routes>
  )
}
