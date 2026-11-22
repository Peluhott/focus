import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { WarningIcon } from '@phosphor-icons/react'
import { activeOf, useGoals } from '../lib/goals'
import { useProjects } from '../lib/projects'
import { useAiOn } from '../lib/settings'
import { useAlignmentPolling, useTodos } from '../lib/todos'

const today = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

/**
 * Signed-in shell (README "Global shell"): the wordmark and dateline on the
 * left, index tabs with live counts on the right, all sitting on one rule.
 */
export default function Shell({ children }: { children: ReactNode }) {
  const { data: goals } = useGoals()
  const { data: todos } = useTodos()
  // "open" = everything but archived; shares the Projects page's default cache.
  const { data: projects } = useProjects('open', 'all')
  const aiOn = useAiOn()
  useAlignmentPolling(todos)
  const flagged = todos?.filter((t) => t.alignment_status === 'unaligned').length ?? 0
  const [dateline] = useState(() => today.format(new Date()))

  const links = [
    { to: '/goals', label: 'Goals', count: goals ? activeOf(goals).length : undefined },
    { to: '/todos', label: 'To-dos', count: todos?.length },
    { to: '/projects', label: 'Projects', count: projects?.length },
    { to: '/calendar', label: 'Calendar', count: undefined },
    { to: '/settings', label: 'Settings', count: undefined },
  ]

  return (
    <>
      <header className="shell-header">
        <div className="shell-head-row">
          <div className="shell-brand">
            <span className="shell-wordmark">Focus</span>
            <span className="shell-dateline">
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
            </span>
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
        </div>
        <div className="shell-rule" />
      </header>
      <main className="shell-main">{children}</main>
    </>
  )
}
