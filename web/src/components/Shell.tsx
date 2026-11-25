import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { WarningIcon } from '@phosphor-icons/react'
import { activeOf, useGoals } from '../lib/goals'
import { useNotes } from '../lib/notes'
import { useProjects } from '../lib/projects'
import { useAiOn, useSettings } from '../lib/settings'
import { useAlignmentPolling, useTodos } from '../lib/todos'
import { useWorkspace, WORKSPACE_LABEL, WORKSPACES } from '../lib/workspace'
import NavTimer from './NavTimer'

const today = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

/**
 * Signed-in shell (NAV-AND-TIMER.md): two rows on one rule. Wordmark and
 * workspace switch over the tabs on the left; the dateline over the timer
 * on the right. Everything here reflects the current workspace.
 */
export default function Shell({ children }: { children: ReactNode }) {
  const { data: goals } = useGoals()
  const { data: todos } = useTodos()
  // "open" = everything but archived; shares the Projects page's default cache.
  const { data: projects } = useProjects('open', 'all')
  const { data: notes } = useNotes()
  const { data: settings } = useSettings()
  const aiOn = useAiOn()
  useAlignmentPolling(todos)
  const flagged = todos?.filter((t) => t.alignment_status === 'unaligned').length ?? 0
  const [dateline] = useState(() => today.format(new Date()))
  const { workspace, switching, switchTo } = useWorkspace()

  const links = [
    { to: '/goals', label: 'Goals', count: goals ? activeOf(goals).length : undefined },
    { to: '/todos', label: 'To-dos', count: todos?.length },
    { to: '/projects', label: 'Projects', count: projects?.length },
    { to: '/notes', label: 'Notes', count: notes?.length },
    { to: '/calendar', label: 'Calendar', count: undefined },
    { to: '/settings', label: 'Settings', count: undefined },
  ]

  return (
    <>
      <header className="shell-header">
        <div className="shell-grid">
          <div className="shell-brand">
            <span className="shell-wordmark">Focus</span>
            <div className="seg shell-workspace" role="radiogroup" aria-label="Workspace">
              {WORKSPACES.map((ws) => (
                <label key={ws} className="seg-opt">
                  <input
                    type="radio"
                    name="workspace"
                    checked={workspace === ws}
                    disabled={switching}
                    onChange={() => switchTo(ws)}
                  />
                  {WORKSPACE_LABEL[ws]}
                </label>
              ))}
            </div>
          </div>
          <div className="shell-rail">
            <span>{dateline}</span>
            {todos && (
              <span>
                {todos.length} open {todos.length === 1 ? 'to-do' : 'to-dos'}
              </span>
            )}
            {aiOn && flagged > 0 && (
              <span className="shell-flag">
                <WarningIcon aria-hidden />
                {flagged} flagged
              </span>
            )}
          </div>
          <nav className="shell-tabs" aria-label="Main">
            {links.map((l) => (
              // NavLink sets aria-current="page" on the current tab (and keeps
              // Projects current on a project's detail page).
              <NavLink key={l.to} to={l.to} className="shell-tab">
                <span className="shell-tab-label">
                  <span className="shell-tab-name">{l.label}</span>
                  {l.count !== undefined && <span className="shell-tab-count">{l.count}</span>}
                </span>
                <span className="shell-tab-bar" aria-hidden />
              </NavLink>
            ))}
          </nav>
          <div className="shell-timer">
            <NavTimer defaultMinutes={settings?.timer_minutes} />
          </div>
        </div>
        <div className="shell-rule" />
      </header>
      <main className="shell-main">{children}</main>
    </>
  )
}
