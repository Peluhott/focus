import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  CalendarBlankIcon,
  ChatCircleTextIcon,
  CheckSquareIcon,
  FileIcon,
  FolderIcon,
  FolderPlusIcon,
  ListChecksIcon,
  MagnifyingGlassIcon,
  NoteIcon,
  NotePencilIcon,
  PlusIcon,
  TargetIcon,
  TimerIcon,
} from '@phosphor-icons/react'
import { get } from '../lib/api'
import { useCreateNote } from '../lib/notes'
import { tempId } from '../lib/optimistic'
import { closeOverlay, openFeedback, openSearch, startTimer, useOverlay } from '../lib/overlays'
import { useCreateProject } from '../lib/projects'
import { useToast } from '../lib/toast'
import { useAddTodo, useTodos } from '../lib/todos'
import { useCurrentWorkspaceInfo } from '../lib/workspaces'

/** One hit from GET /search (search_controller.ts). */
type Hit = {
  type: 'todo' | 'goal' | 'project' | 'task' | 'file' | 'note' | 'calendar'
  id: number
  title: string
  sub: string | null
  todo_id?: number
  goal_id?: number
  project_id?: number
  note_id?: number
  archived?: boolean
}
type SearchResponse = { query: string; groups: { key: string; label: string; items: Hit[] }[] }

type Row = {
  id: string
  icon: ReactNode
  title: string
  sub?: string | null
  /** Highlight the query in the title. */
  highlight?: boolean
  run: () => void
}
type Group = { label: string; rows: Row[] }

const ICONS: Record<Hit['type'], ReactNode> = {
  todo: <CheckSquareIcon aria-hidden />,
  goal: <TargetIcon aria-hidden />,
  project: <FolderIcon aria-hidden />,
  task: <ListChecksIcon aria-hidden />,
  file: <FileIcon aria-hidden />,
  note: <NoteIcon aria-hidden />,
  calendar: <CalendarBlankIcon aria-hidden />,
}

const inTextField = (el: Element | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    (el.tagName === 'INPUT' &&
      !['checkbox', 'radio', 'button', 'submit'].includes((el as HTMLInputElement).type)))

/** The part of `title` matching `q`, set apart (SEARCH.md "Match highlight"). */
function Highlight({ title, q }: { title: string; q: string }) {
  const at = q ? title.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (at < 0) return <>{title}</>
  return (
    <>
      {title.slice(0, at)}
      <mark className="search-hit">{title.slice(at, at + q.length)}</mark>
      {title.slice(at + q.length)}
    </>
  )
}

/** "Search everything" in the date line (SEARCH.md trigger 3c). */
export function SearchTrigger() {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <button type="button" className="search-trigger" onClick={openSearch}>
      <MagnifyingGlassIcon size={15} aria-hidden />
      <span className="search-trigger-label">Search everything</span>
      <span className="search-trigger-kbd">{isMac ? '⌘K' : 'Ctrl K'}</span>
    </button>
  )
}

/**
 * The ⌘K palette (SEARCH.md 2a): goals, to-dos, projects, files, notes and
 * dated items in this workspace, plus "Add as a to-do" and quick actions.
 * Opens with ⌘K / Ctrl+K anywhere, or / outside text fields.
 */
export default function SearchPalette() {
  const overlay = useOverlay()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        openSearch()
      } else if (e.key === '/' && !e.metaKey && !e.ctrlKey && !inTextField(document.activeElement)) {
        e.preventDefault()
        openSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return overlay === 'search' ? <Palette /> : null
}

function Palette() {
  const navigate = useNavigate()
  const toast = useToast()
  const addTodo = useAddTodo()
  const createNote = useCreateNote()
  const createProject = useCreateProject()
  const { data: todos } = useTodos()
  const workspace = useCurrentWorkspaceInfo()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selected, setSelected] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const q = query.trim()

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(q), 120)
    return () => window.clearTimeout(timer)
  }, [q])

  const { data } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => get<SearchResponse>(`/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced !== '',
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })

  const go = (fn: () => void) => () => {
    closeOverlay()
    fn()
  }

  const open = (hit: Hit): (() => void) => {
    if (hit.todo_id !== undefined) {
      return go(() => navigate('/todos', { state: { focusTodo: hit.todo_id, expand: true } }))
    }
    if (hit.note_id !== undefined) return go(() => navigate('/notes', { state: { selectNote: hit.note_id } }))
    if (hit.goal_id !== undefined) {
      return go(() => navigate('/goals', { state: { focusGoal: hit.goal_id, archived: !!hit.archived } }))
    }
    if (hit.project_id !== undefined) return go(() => navigate(`/projects/${hit.project_id}`))
    return go(() => {})
  }

  const groups: Group[] = useMemo(() => {
    if (!q) {
      const jump: Row[] = (todos ?? []).slice(0, 2).map((t) => ({
        id: `jump-${t.id}`,
        icon: ICONS.todo,
        title: t.title,
        sub: 'To-do',
        run: go(() => navigate('/todos', { state: { focusTodo: t.id, expand: true } })),
      }))
      const actions: Row[] = [
        {
          id: 'act-todo',
          icon: <PlusIcon aria-hidden />,
          title: 'New to-do',
          run: go(() => navigate('/todos', { state: { focusAdd: true } })),
        },
        { id: 'act-timer', icon: <TimerIcon aria-hidden />, title: 'Start the timer', run: go(startTimer) },
        {
          id: 'act-note',
          icon: <NotePencilIcon aria-hidden />,
          title: 'New note',
          run: go(() =>
            createNote.mutate(undefined, {
              onSuccess: (note) => navigate('/notes', { state: { selectNote: note.id, focusTitle: true } }),
            })
          ),
        },
        {
          id: 'act-project',
          icon: <FolderPlusIcon aria-hidden />,
          title: 'New project',
          run: go(() =>
            createProject.mutate(undefined, {
              onSuccess: (p) => navigate(`/projects/${p.id}`, { state: { isNew: true } }),
            })
          ),
        },
        {
          id: 'act-feedback',
          icon: <ChatCircleTextIcon aria-hidden />,
          title: 'Send feedback',
          run: openFeedback,
        },
      ]
      return [
        ...(jump.length ? [{ label: 'Jump to', rows: jump }] : []),
        { label: 'Quick actions', rows: actions },
      ]
    }
    const found: Group[] =
      data && data.query === debounced
        ? data.groups.map((g) => ({
            label: g.label,
            rows: g.items.map((hit) => ({
              id: `${g.key}-${hit.type}-${hit.id}`,
              icon: ICONS[hit.type],
              title: hit.title,
              sub: hit.sub,
              highlight: true,
              run: open(hit),
            })),
          }))
        : []
    const add: Group = {
      label: 'Add',
      rows: [
        {
          id: 'add-todo',
          icon: <PlusIcon aria-hidden />,
          title: `Add “${q}” as a to-do`,
          run: go(() => {
            addTodo.mutate({ tempId: tempId(), title: q })
            toast('Added to To-dos')
          }),
        },
      ],
    }
    return [...found, add]
  }, [q, debounced, data, todos])

  const rows = groups.flatMap((g) => g.rows)
  const nothing = q !== '' && debounced === q && !!data && groups.length === 1
  const current = Math.min(selected, rows.length - 1)

  useEffect(() => setSelected(0), [q])
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${current}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [current])

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((i) => (i + 1) % Math.max(rows.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((i) => (i - 1 + rows.length) % Math.max(rows.length, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      rows[current]?.run()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeOverlay()
    }
  }

  let index = -1
  return (
    <>
      <div className="overlay-backdrop" onClick={closeOverlay} />
      <div className="overlay-dialog search-dialog" role="dialog" aria-modal="true" aria-label="Search">
        <div className="search-input-row">
          <MagnifyingGlassIcon size={22} className="search-input-icon" aria-hidden />
          <input
            className="search-input"
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-activedescendant={rows[current] ? `search-opt-${current}` : undefined}
            aria-autocomplete="list"
            placeholder="Search goals, to-dos, projects, notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd className="search-kbd">esc</kbd>
        </div>
        <div className="search-results" id="search-results" role="listbox" ref={listRef}>
          {nothing && <p className="search-empty">Nothing matches “{q}”.</p>}
          {groups.map((g) => (
            <div key={g.label} role="group" aria-label={g.label}>
              <div className="search-group-label">{g.label}</div>
              {g.rows.map((row) => {
                index++
                const i = index
                return (
                  <div
                    key={row.id}
                    id={`search-opt-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === current}
                    className={`search-row${i === current ? ' is-selected' : ''}`}
                    onMouseMove={() => setSelected(i)}
                    onClick={row.run}
                  >
                    <span className="search-row-icon">{row.icon}</span>
                    <span className="search-row-text">
                      <span className="search-row-title">
                        {row.highlight ? <Highlight title={row.title} q={q} /> : row.title}
                      </span>
                      {row.sub && <span className="search-row-sub">{row.sub}</span>}
                    </span>
                    {i === current && <span className="search-row-open">Open ↵</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div className="search-footer">
          <span>↑ ↓ to move</span>
          <span>↵ to open</span>
          <span>esc to close</span>
          {workspace && <span className="search-footer-ws">Searching {workspace.name}</span>}
        </div>
      </div>
    </>
  )
}
