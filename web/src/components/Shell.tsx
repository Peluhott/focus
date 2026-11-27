import { useState, type FormEvent, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { PlusIcon, WarningIcon } from '@phosphor-icons/react'
import { activeOf, useGoals } from '../lib/goals'
import { useNotes } from '../lib/notes'
import { useProjects } from '../lib/projects'
import { useAiOn, useSettings } from '../lib/settings'
import { useAlignmentPolling, useTodos } from '../lib/todos'
import { errorMessage } from '../lib/optimistic'
import { useToast } from '../lib/toast'
import { useWorkspace } from '../lib/workspace'
import { useCreateWorkspace, useWorkspaces } from '../lib/workspaces'
import Feedback from './Feedback'
import NavTimer from './NavTimer'
import SearchPalette, { SearchTrigger } from './SearchPalette'

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
  const { data: workspaces } = useWorkspaces()

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
              {(workspaces ?? []).map((ws) => (
                <label key={ws.id} className="seg-opt">
                  <input
                    type="radio"
                    name="workspace"
                    checked={workspace === ws.id}
                    disabled={switching}
                    onChange={() => switchTo(ws.id)}
                  />
                  {ws.name}
                </label>
              ))}
            </div>
            <NewWorkspace onCreated={(id) => switchTo(id)} />
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
            <SearchTrigger />
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
      <SearchPalette />
      <Feedback />
    </>
  )
}

/** "+" after the workspace switch: name a new workspace, then open it. */
function NewWorkspace({ onCreated }: { onCreated: (id: number) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const create = useCreateWorkspace()
  const toast = useToast()

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = name.trim()
    if (!value) return
    create.mutate(value, {
      onSuccess: (ws) => {
        setName('')
        setOpen(false)
        onCreated(ws.id)
      },
      onError: (error) => toast(errorMessage(error)),
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-ghost btn-icon shell-ws-add"
        aria-label="New workspace"
        title="New workspace"
        onClick={() => setOpen(true)}
      >
        <PlusIcon size={18} aria-hidden />
      </button>
    )
  }
  return (
    <form className="shell-ws-form" onSubmit={submit}>
      <input
        className="input shell-ws-input"
        autoFocus
        maxLength={40}
        placeholder="Workspace name"
        aria-label="New workspace name"
        value={name}
        disabled={create.isPending}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setName('')
            setOpen(false)
          }
        }}
        onBlur={() => {
          if (!name.trim()) setOpen(false)
        }}
      />
    </form>
  )
}
