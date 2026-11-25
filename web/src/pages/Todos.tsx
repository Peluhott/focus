import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowClockwiseIcon,
  CalendarBlankIcon,
  CheckIcon,
  DotsThreeIcon,
  FootprintsIcon,
  LinkIcon,
  RepeatIcon,
  TargetIcon,
  TrashIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import HintCard from '../components/HintCard'
import InlineInput from '../components/InlineInput'
import NotesField from '../components/NotesField'
import SortableList from '../components/SortableList'
import { completionToast, milestoneSentence } from '../lib/climb'
import { isOverdue, shortDate, todayISO } from '../lib/dates'
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
  useLogCompletion,
  useUndoCompletion,
  doneToday,
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
  // Open "Help me start" cards (closing one discards it).
  const [hints, setHints] = useState<Record<number, boolean>>({})

  // Recurring to-dos sit in their own band above the one-time list
  // (RECURRING-TODOS.md "Recurring band"); each group reorders on its own.
  const recurring = todos?.filter((t) => t.recurring) ?? []
  const oneTime = todos?.filter((t) => !t.recurring) ?? []

  function renderGroup(items: Todo[], others: Todo[], className: string) {
    if (items.length === 0) return null
    return (
      <SortableList
        items={items}
        noun="to-do"
        className={className}
        itemId={(t) => `todo-${t.id}`}
        itemClassName={(t) => `todo-row${rowTint(t, aiOn)}`}
        isLocked={(t) => isTemp(t.id)}
        onMove={(id, placement, order) => move.mutate({ id, placement, order: [...order, ...others] })}
        renderItem={(todo, handle) => (
          <TodoRow
            todo={todo}
            handle={handle}
            expanded={!!expanded[todo.id]}
            onToggle={() => setExpanded((s) => ({ ...s, [todo.id]: !s[todo.id] }))}
            hintOpen={aiOn && !!hints[todo.id]}
            onToggleHint={() => setHints((s) => ({ ...s, [todo.id]: !s[todo.id] }))}
            index={(todos ?? []).findIndex((t) => t.id === todo.id)}
            aiOn={aiOn}
          />
        )}
      />
    )
  }

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
        <>
          {recurring.length > 0 && (
            <div className="recurring-band">
              <div className="recurring-label">
                <span className="recurring-kicker">
                  <RepeatIcon aria-hidden />
                  Recurring
                </span>
                <span className="recurring-sub">Always on your list. Check off each time.</span>
              </div>
              {renderGroup(recurring, oneTime, 'recurring-list')}
            </div>
          )}
          {renderGroup(oneTime, recurring, `todo-list${recurring.length > 0 ? ' after-band' : ''}`)}
        </>
      )}
      {!isPending && todos?.length === 0 && <p className="empty muted centered">Nothing on the list.</p>}
    </section>
  )
}

/**
 * Row color (spec "How it's shown", multi-goal spec): red for unaligned;
 * light green when it serves 2+ goals but not all; green for every active
 * goal. The label next to the chips carries the same meaning.
 */
function rowTint(t: Todo, aiOn: boolean) {
  if (!aiOn) return ''
  if (t.alignment_status === 'unaligned') return ' is-unaligned'
  if (t.alignment_status !== 'aligned') return ''
  if (t.match_level === 'all') return ' is-match-all'
  if (t.match_level === 'several') return ' is-match-several'
  return ''
}

/** Show up to 3 goal chips, then "+N". */
const MAX_CHIPS = 3

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
  hintOpen,
  onToggleHint,
  index,
  aiOn,
}: {
  todo: Todo
  handle: ReactNode
  expanded: boolean
  onToggle: () => void
  hintOpen: boolean
  onToggleHint: () => void
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
  const logCompletion = useLogCompletion()
  const undoCompletion = useUndoCompletion()
  // A recurring check-off shows checked for 1 s, then clears itself.
  const [flash, setFlash] = useState(false)
  const remove = useDeleteTodo()
  const restore = useRestoreTodo()
  const qc = useQueryClient()
  const toast = useToast()
  const saved = !isTemp(todo.id)
  const overdue = todo.date ? isOverdue(todo.date) : false
  // AI display rules (spec "How it's shown"); nothing at all while it's off.
  const status = aiOn ? todo.alignment_status : null
  const matches = todo.matches ?? []
  const manual = todo.alignment_source === 'manual'
  const recurring = todo.recurring
  const today = doneToday(todo, todayISO())

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
    if (flash) return // ignore clicks while the 1 s check shows
    // With the AI on, the completion counts toward the climb; say so when it
    // reaches a camp or tops a level.
    const before = aiOn ? qc.getQueryData<CompletionStats>(statsKey)?.total : undefined
    if (recurring && !offTrack) {
      onLogRecurring(before)
      return
    }
    const message = offTrack
      ? recurring
        ? 'Moved to the off-track backlog. It no longer repeats.'
        : 'Moved to off-track'
      : before === undefined
        ? 'To-do completed'
        : completionToast(before, before + 1)
    complete.mutate({ todo })
    toast(message, () => reopen.mutate({ todo, index }))
  }

  /** Recurring: log one completion; the row stays where it is. */
  function onLogRecurring(before: number | undefined) {
    setFlash(true)
    window.setTimeout(() => setFlash(false), 1000)
    const prev = todo
    const pending = logCompletion.mutateAsync({ todo })
    pending.catch(() => {}) // the mutation already toasts its error
    const milestone = before === undefined ? null : milestoneSentence(before, before + 1)
    const message = `Completion logged · Done ${todo.completion_count + 1}×.${milestone ? ` ${milestone}` : ''}`
    toast(message, () => {
      pending
        .then((saved) => {
          if (saved.completion_id !== undefined) {
            undoCompletion.mutate({ todo: prev, completionId: saved.completion_id })
          }
        })
        .catch(() => {})
    })
  }

  function onRepeat(on: boolean) {
    update.mutate({ id: todo.id, patch: { recurring: on } })
    if (on && todo.date) toast('Repeat is on. The date was removed.')
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
          checked={flash}
          disabled={!saved}
          onChange={onComplete}
        />
        {recurring && (
          <RepeatIcon className="repeat-icon" size={16} aria-label="Repeats">
            <title>Repeats</title>
          </RepeatIcon>
        )}
        <InlineInput
          value={todo.title}
          aria-label="To-do"
          className="todo-title"
          allowEmpty={false}
          readOnly={!saved}
          onCommit={(title) => update.mutate({ id: todo.id, patch: { title: title.trim() } })}
        />
        {recurring && (
          <span className="tally" aria-label={`Done ${todo.completion_count} times${today ? ', done today' : ''}`}>
            <span aria-hidden>Done {todo.completion_count}×</span>
            {today && (
              <span className="tally-today" aria-hidden>
                <CheckIcon size={12} />
                today
              </span>
            )}
          </span>
        )}
        {status === 'aligned' && (todo.match_level === 'several' || todo.match_level === 'all') && (
          <span className={`tag match-label match-${todo.match_level}`}>
            {todo.match_level === 'all' ? 'All goals' : `${matches.length} goals`}
          </span>
        )}
        {status === 'aligned' &&
          matches.slice(0, MAX_CHIPS).map((match) => (
            <span
              key={match.id}
              className="tag tag-accent align-chip"
              title={manual ? `Linked by you to ${match.title}` : (todo.alignment_reason ?? match.title)}
            >
              <TargetIcon aria-hidden />
              <span className="align-chip-name">{match.title}</span>
            </span>
          ))}
        {status === 'aligned' && matches.length > MAX_CHIPS && (
          <span
            className="tag tag-accent align-chip"
            title={matches
              .slice(MAX_CHIPS)
              .map((m) => m.title)
              .join(', ')}
          >
            +{matches.length - MAX_CHIPS}
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
        {todo.date && !recurring && (
          <span className={`tag date-chip${overdue ? ' overdue' : ''}`}>
            {overdue ? `Overdue · ${shortDate(todo.date)}` : shortDate(todo.date)}
          </span>
        )}
        {aiOn && saved && (
          <button
            className={`btn btn-ghost btn-icon row-icon hint-button${hintOpen ? ' is-open' : ''}`}
            aria-label="Help me start"
            title="Help me start"
            aria-expanded={hintOpen}
            onClick={onToggleHint}
          >
            <FootprintsIcon size={18} aria-hidden />
          </button>
        )}
        <button
          className="btn btn-ghost btn-icon row-icon"
          aria-label={recurring ? 'Notes and repeat' : 'Date and notes'}
          title={recurring ? 'Notes and repeat' : 'Date and notes'}
          aria-expanded={expanded}
          disabled={!saved}
          onClick={onToggle}
        >
          {recurring ? <DotsThreeIcon size={18} aria-hidden /> : <CalendarBlankIcon size={18} aria-hidden />}
        </button>
      </div>
      {hintOpen && saved && <HintCard todo={todo} onClose={onToggleHint} />}
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
            <label className="repeat-toggle">
              <input
                type="checkbox"
                role="switch"
                checked={recurring}
                onChange={(e) => onRepeat(e.target.checked)}
              />
              <RepeatIcon size={16} aria-hidden />
              Repeat
            </label>
            {!recurring && (
              <>
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
              </>
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
          {recurring && (
            <p className="repeat-note">
              Stays on the list. Each check-off logs one completion. Repeating to-dos have no date, so
              they don't appear on the calendar.
            </p>
          )}
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
