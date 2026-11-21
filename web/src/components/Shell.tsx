import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { WarningIcon } from '@phosphor-icons/react'
import { useMe } from '../lib/auth'
import { activeOf, useGoals } from '../lib/goals'
import { useAiOn } from '../lib/settings'
import { useAlignmentPolling, useTodos } from '../lib/todos'

const LINKS = [
  { to: '/todos', label: 'To-dos' },
  { to: '/goals', label: 'Goals' },
  { to: '/projects', label: 'Projects' },
  { to: '/settings', label: 'Settings' },
]

const today = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

/**
 * Signed-in shell: nav, the masthead's thick-thin rules and the dateline rail
 * (README "Global shell"), with live goal and to-do counts.
 */
export default function Shell({ children }: { children: ReactNode }) {
  const { data: user } = useMe()
  const { data: goals } = useGoals()
  const { data: todos } = useTodos()
  const aiOn = useAiOn()
  useAlignmentPolling(todos)
  const counts = {
    activeGoals: goals ? activeOf(goals).length : undefined,
    openTodos: todos?.length,
    flagged: todos?.filter((t) => t.alignment_status === 'unaligned').length ?? 0,
  }
  const [dateline] = useState(() => today.format(new Date()))
  return (
    <>
      <header className="shell-header">
        <nav className="nav shell-nav">
          <span className="nav-brand">Focus</span>
          {LINKS.map((l) => (
            // NavLink sets aria-current="page" on the active link, which the
            // .nav styles colour. Project detail pages keep "Projects" current.
            <NavLink key={l.to} to={l.to}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="rule-thick" />
        <div className="rule-thin" />
        <div className="rail">
          <span>{dateline}</span>
          {counts.activeGoals !== undefined && user && (
            <span>
              {counts.activeGoals} of {user.focus_limit} active goals
            </span>
          )}
          {counts.openTodos !== undefined && (
            <span>
              {counts.openTodos} open {counts.openTodos === 1 ? 'to-do' : 'to-dos'}
            </span>
          )}
          {aiOn && !!counts.flagged && (
            <span className="rail-flag">
              <WarningIcon aria-hidden />
              {counts.flagged} flagged
            </span>
          )}
        </div>
        <div className="rule-thin" />
      </header>
      <main className="shell-main">{children}</main>
    </>
  )
}
