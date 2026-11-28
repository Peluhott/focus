import { useState, type FormEvent, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { CalendarBlankIcon, MagnifyingGlassIcon, NoteIcon, PlusIcon } from '@phosphor-icons/react'
import { activeOf, useGoals } from '../lib/goals'
import { useProjects } from '../lib/projects'
import { useSettings } from '../lib/settings'
import { useAlignmentPolling, useTodos } from '../lib/todos'
import { errorMessage } from '../lib/optimistic'
import { openSearch } from '../lib/overlays'
import { useToast } from '../lib/toast'
import { useWorkspace } from '../lib/workspace'
import { useCreateWorkspace, useWorkspaces } from '../lib/workspaces'
import AccountMenu from './AccountMenu'
import AiLimitNotice from './AiLimitNotice'
import Feedback from './Feedback'
import NavTimer from './NavTimer'
import SearchPalette from './SearchPalette'

/**
 * Signed-in shell (V2-UI-CHANGES §1–2): the workspace tabs, then one header
 * row on the rule: wordmark, Goals / To-dos / Projects, the Notes, Calendar
 * and Search tools, the timer and the account menu. Everything here
 * reflects the current workspace.
 */
export default function Shell({ children }: { children: ReactNode }) {
  const { data: goals } = useGoals()
  const { data: todos } = useTodos()
  // "open" = everything but archived; shares the Projects page's default cache.
  const { data: projects } = useProjects('open', 'all')
  const { data: settings } = useSettings()
  useAlignmentPolling(todos)
  const { workspace, switching, switchTo } = useWorkspace()
  const { data: workspaces } = useWorkspaces()

  const sections = [
    { to: '/goals', label: 'Goals', count: goals ? activeOf(goals).length : undefined },
    { to: '/todos', label: 'To-dos', count: todos?.length },
    { to: '/projects', label: 'Projects', count: projects?.length },
  ]
  const tools = [
    { to: '/notes', label: 'Notes', icon: <NoteIcon aria-hidden /> },
    { to: '/calendar', label: 'Calendar', icon: <CalendarBlankIcon aria-hidden /> },
  ]

  return (
    <>
      <header className="shell-header">
        <div className="ws-tabs" role="tablist" aria-label="Workspaces">
          {(workspaces ?? []).map((ws) => (
            <button
              key={ws.id}
              type="button"
              role="tab"
              className="ws-tab"
              aria-selected={workspace === ws.id}
              disabled={switching}
              onClick={() => switchTo(ws.id)}
            >
              <span>{ws.name}</span>
              <span className="ws-tab-bar" aria-hidden />
            </button>
          ))}
          <NewWorkspace onCreated={(id) => switchTo(id)} />
        </div>
        <div className="shell-row">
          <span className="shell-wordmark">Focus</span>
          <nav className="shell-tabs" aria-label="Sections">
            {sections.map((l) => (
              // NavLink sets aria-current="page" (and keeps Projects current
              // on a project's detail page).
              <NavLink key={l.to} to={l.to} className="shell-tab">
                <span className="shell-tab-label">
                  <span className="shell-tab-name">{l.label}</span>
                  {l.count !== undefined && <span className="shell-tab-count">{l.count}</span>}
                </span>
                <span className="shell-tab-bar" aria-hidden />
              </NavLink>
            ))}
          </nav>
          <div className="shell-tools">
            {tools.map((t) => (
              <span key={t.to} className="shell-tool">
                <NavLink to={t.to} className="btn btn-ghost shell-tool-btn">
                  {t.icon}
                  {t.label}
                </NavLink>
                <span className="shell-tool-pad" aria-hidden />
              </span>
            ))}
            <span className="shell-tool">
              <button type="button" className="btn btn-ghost shell-tool-btn is-search" title="Search  ⌘K" onClick={openSearch}>
                <MagnifyingGlassIcon aria-hidden />
                Search
              </button>
              <span className="shell-tool-pad" aria-hidden />
            </span>
          </div>
          <div className="shell-timer">
            <NavTimer defaultMinutes={settings?.timer_minutes} />
          </div>
          <AccountMenu />
        </div>
        <div className="shell-rule" />
        <AiLimitNotice />
      </header>
      <main className="shell-main">{children}</main>
      <SearchPalette />
      <Feedback />
    </>
  )
}

/** "+ New" at the end of the workspace tabs: name a workspace, then open it. */
function NewWorkspace({ onCreated }: { onCreated: (id: number) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const create = useCreateWorkspace()
  const toast = useToast()

  const cancel = () => {
    setName('')
    setOpen(false)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = name.trim()
    if (!value) return cancel()
    create.mutate(value, {
      onSuccess: (ws) => {
        cancel()
        onCreated(ws.id)
      },
      onError: (error) => toast(errorMessage(error)),
    })
  }

  if (!open) {
    return (
      <button type="button" className="ws-tab ws-new" onClick={() => setOpen(true)}>
        <span className="ws-new-label">
          <PlusIcon size={14} aria-hidden />
          New
        </span>
        <span className="ws-tab-bar" aria-hidden />
      </button>
    )
  }
  return (
    <form className="ws-new-form" onSubmit={submit}>
      <input
        className="ws-new-input"
        autoFocus
        maxLength={40}
        placeholder="Name, then Enter"
        aria-label="New workspace name"
        value={name}
        disabled={create.isPending}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancel()
        }}
        onBlur={() => {
          if (!name.trim()) cancel()
        }}
      />
    </form>
  )
}
