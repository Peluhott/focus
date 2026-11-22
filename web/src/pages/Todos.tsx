import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowClockwiseIcon,
  CalendarBlankIcon,
  LinkIcon,
  TargetIcon,
  TrashIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import InlineInput from '../components/InlineInput'
import NotesField from '../components/NotesField'
import SortableList from '../components/SortableList'
import { completionToast } from '../lib/climb'
import { isOverdue, shortDate } from '../lib/dates'
import { activeOf, useGoals } from '../lib/goals'
import { useAiOn } from '../lib/settings'
import { isTemp, tempId } from '../lib/optimistic'
import { statsKey, useCompletionStats, type CompletionStats } from '../lib/stats'
import { useToast } from '../lib/toast'
import {
  useAddTodo,
  useCompleteTodo,
  useDeleteTodo,
  useDismissTodo,
  useLinkTodo,
  useMoveTodo,
  useRecheckTodo,
  useReopenTodo,
  useRestoreTodo,
  goesOffTrack,
  todosKey,
  useTodos,
  useUpdateTodo,
} from '../lib/todos'
import type { LinkTarget, Placement, Todo } from '../lib/types'

/** To-dos (README §3): one list, in the order you set. */
export default function Todos() {
  const { data: todos, isPending, isError } = useTodos()
  const add = useAddTodo()
  const move = useMoveTodo()
  const aiOn = useAiOn()
  // Loaded here too, so completion toasts can tell when you reach a camp.
  useCompletionStats()
  useFocusTarget(!!todos)
  const [draft, setDraft] = useState('')
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  function onQuickAdd(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const title = draft.trim()
    if (!title) return
    add.mutate({ tempId: tempId(), title })
    setDraft('')
  }

  return (
    <section data-screen-label="To-dos">
      <h1 className="page-title centered">To-dos</h1>
      <p className="page-subtitle centered">One list, in the order you set.</p>
      <input
        className="input quick-add"
        placeholder="Add a to-do and press Enter"
        aria-label="Add a to-do"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onQuickAdd}
      />
      {isError && <p className="muted centered">Couldn't load your to-dos.</p>}
      {todos && (
        <SortableList
          items={todos}
          noun="to-do"
          className="todo-list"
          itemId={(t) => `todo-${t.id}`}
          itemClassName={(t) =>
            aiOn && t.alignment_status === 'unaligned' ? 'todo-row is-unaligned' : 'todo-row'
          }
          isLocked={(t) => isTemp(t.id)}
          onMove={(id, placement, order) => move.mutate({ id, placement, order })}
          renderItem={(todo, handle) => (
            <TodoRow
              todo={todo}
              handle={handle}
              expanded={!!expanded[todo.id]}
              onToggle={() => setExpanded((s) => ({ ...s, [todo.id]: !s[todo.id] }))}
              index={todos.findIndex((t) => t.id === todo.id)}
              aiOn={aiOn}
            />
          )}
        />
      )}
      {!isPending && todos?.length === 0 && <p className="empty muted centered">Nothing on the list.</p>}
    </section>
  )
}

/**
 * Coming from the Calendar: once the list has loaded, scroll to the to-do it
 * opened and flash that row.
 */
function useFocusTarget(loaded: boolean) {
  const location = useLocation()
  const navigate = useNavigate()
  const target = (location.state as { focusTodo?: number } | null)?.focusTodo
  useEffect(() => {
    if (!loaded || target === undefined) return
    const el = document.getElementById(`todo-${target}`)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.add('is-target')
      window.setTimeout(() => el.classList.remove('is-target'), 2000)
    }
    // Clear the state so a refresh or Back doesn't scroll again.
    navigate('.', { replace: true, state: null })
  }, [loaded, target, navigate])
}

function TodoRow({
  todo,
  handle,
  expanded,
  onToggle,
  index,
  aiOn,
}: {
  todo: Todo
  handle: ReactNode
  expanded: boolean
  onToggle: () => void
  index: number
  aiOn: boolean
}) {
  const update = useUpdateTodo()
  const dismiss = useDismissTodo()
  const recheck = useRecheckTodo()
  const link = useLinkTodo()
  const [linking, setLinking] = useState(false)
  const complete = useCompleteTodo()
  const reopen = useReopenTodo()
  const remove = useDeleteTodo()
  const restore = useRestoreTodo()
  const qc = useQueryClient()
  const toast = useToast()
  const saved = !isTemp(todo.id)
  const overdue = todo.date ? isOverdue(todo.date) : false
  // AI display rules (spec "How it's shown"); nothing at all while it's off.
  const status = aiOn ? todo.alignment_status : null
  const match = todo.matched_goal
  const manual = todo.alignment_source === 'manual'

  /** Delete now, with Undo putting it back between the same neighbours. */
  function onDelete() {
    const list = qc.getQueryData<Todo[]>(todosKey) ?? []
    const at = list.findIndex((t) => t.id === todo.id)
    const below = list[at + 1]
    const above = list[at - 1]
    const placement: Placement | null = below
      ? { before_id: below.id }
      : above
        ? { after_id: above.id }
        : null
    remove.mutate({ id: todo.id })
    toast('To-do deleted', () =>
      restore.mutate({ todo, index: at, tempId: tempId(), placement })
    )
  }

  // A red to-do's checkbox moves it to the off-track backlog instead.
  const offTrack = goesOffTrack(todo, aiOn)

  function onComplete() {
    // With the AI on, the completion counts toward the climb; say so when it
    // reaches a camp or tops a level.
    const before = aiOn ? qc.getQueryData<CompletionStats>(statsKey)?.total : undefined
    const message = offTrack
      ? 'Moved to off-track'
      : before === undefined
        ? 'To-do completed'
        : completionToast(before, before + 1)
    complete.mutate({ todo })
    toast(message, () => reopen.mutate({ todo, index }))
  }

  // Unaligned to-dos are blurred until you hover or focus the line, or open
  // its panel or link picker.
  const blurred = status === 'unaligned' && !expanded && !linking

  return (
    <>
      <div className={`row-main todo-main${blurred ? ' is-blurred' : ''}`}>
        {handle}
        <input
          type="checkbox"
          className="check check-18"
          aria-label={offTrack ? 'Move to off-track' : 'Complete'}
          title={offTrack ? 'Move to off-track.' : undefined}
          checked={false}
          disabled={!saved}
          onChange={onComplete}
        />
        <InlineInput
          value={todo.title}
          aria-label="To-do"
          className="todo-title"
          allowEmpty={false}
          readOnly={!saved}
          onCommit={(title) => update.mutate({ id: todo.id, patch: { title: title.trim() } })}
        />
        {status === 'aligned' && match && (
          <span
            className="tag tag-accent align-chip"
            title={manual ? `Linked by you to ${match.title}` : (todo.alignment_reason ?? match.title)}
          >
            <TargetIcon aria-hidden />
            <span className="align-chip-name">{match.title}</span>
          </span>
        )}
        {status === 'error' && (
          <button
            className="btn btn-ghost retry-link"
            title={todo.alignment_reason ?? 'The AI check failed.'}
            onClick={() => recheck.mutate({ id: todo.id })}
          >
            <ArrowClockwiseIcon aria-hidden />
            Retry check
          </button>
        )}
        {todo.date && (
          <span className={`tag date-chip${overdue ? ' overdue' : ''}`}>
            {overdue ? `Overdue · ${shortDate(todo.date)}` : shortDate(todo.date)}
          </span>
        )}
        <button
          className="btn btn-ghost btn-icon row-icon"
          aria-label="Date and notes"
          aria-expanded={expanded}
          disabled={!saved}
          onClick={onToggle}
        >
          <CalendarBlankIcon size={18} aria-hidden />
        </button>
      </div>
      {status === 'unaligned' && (
        <div className="flag-line">
          <span className="flag-reason">
            <WarningIcon aria-hidden />
            {todo.alignment_reason ?? "Doesn't serve an active goal."}
          </span>
          <button className="btn btn-ghost flag-action" onClick={() => dismiss.mutate({ id: todo.id })}>
            This is fine
          </button>
          <button className="btn btn-ghost flag-action" onClick={() => setLinking(true)}>
            Link to…
          </button>
          <button className="btn btn-ghost flag-action muted" disabled={!saved} onClick={onDelete}>
            <TrashIcon aria-hidden />
            Delete
          </button>
        </div>
      )}
      {linking && saved && (
        <LinkPicker
          linked={manual}
          onPick={(target) => {
            link.mutate({ id: todo.id, target })
            setLinking(false)
          }}
          onCancel={() => setLinking(false)}
        />
      )}
      {expanded && saved && (
        <div className="row-panel">
          <NotesField
            className="on-bg"
            style={{ minHeight: 64 }}
            placeholder="Notes"
            aria-label="Notes"
            value={todo.notes}
            onCommit={(notes) => update.mutate({ id: todo.id, patch: { notes } })}
          />
          <div className="row-panel-actions">
            <input
              type="date"
              className="input on-bg"
              aria-label="Date"
              style={{ width: 'auto' }}
              value={todo.date ?? ''}
              onChange={(e) => update.mutate({ id: todo.id, patch: { date: e.target.value || null } })}
            />
            {todo.date && (
              <button className="btn btn-ghost" onClick={() => update.mutate({ id: todo.id, patch: { date: null } })}>
                Clear date
              </button>
            )}
            {aiOn && (
              <button className="btn btn-ghost" onClick={() => setLinking(true)}>
                <LinkIcon size={16} aria-hidden />
                Link to…
              </button>
            )}
            <button className="btn btn-ghost push-right muted" onClick={onDelete}>
              <TrashIcon size={16} aria-hidden />
              Delete
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * "Link to…" (README §2): one button per active goal. To-dos link to goals
 * only. Picking one sets a manual link the AI never overwrites.
 */
function LinkPicker({
  linked,
  onPick,
  onCancel,
}: {
  linked: boolean
  onPick: (target: LinkTarget | null) => void
  onCancel: () => void
}) {
  const { data: goals } = useGoals()
  const targets: LinkTarget[] = activeOf(goals).map((g) => ({ id: g.id, title: g.title }))
  return (
    <div className="link-line" role="group" aria-label="Link to a goal">
      <span className="link-label">Link to</span>
      {targets.map((t) => (
        <button key={t.id} className="btn btn-secondary link-option" onClick={() => onPick(t)}>
          <TargetIcon aria-hidden />
          {t.title}
        </button>
      ))}
      {targets.length === 0 && <span className="link-label">No active goals.</span>}
      {linked && (
        <button className="btn btn-ghost link-option" onClick={() => onPick(null)}>
          Remove link
        </button>
      )}
      <button className="btn btn-ghost link-option" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
