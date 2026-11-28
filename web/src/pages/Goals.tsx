import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CircleIcon,
  DotsThreeIcon,
  FolderSimpleIcon,
  PlusIcon,
  RepeatIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react'
import AutoGrowTextarea from '../components/AutoGrowTextarea'
import ConfirmDialog, { type ConfirmRequest } from '../components/ConfirmDialog'
import FocusTracker from '../components/FocusTracker'
import GoalSuggestions from '../components/GoalSuggestions'
import OffTrackBacklog from '../components/OffTrackBacklog'
import SortableList from '../components/SortableList'
import { useDismiss } from '../lib/dom'
import {
  activeOf,
  useAddSubGoal,
  useCreateGoal,
  useDeleteGoal,
  useDeleteSubGoal,
  useFocusLimit,
  useGoals,
  useLimitSnapshot,
  useMoveGoal,
  useMoveSubGoal,
  useSetFocusLimit,
  useSetGoalStatus,
  useUpdateGoal,
  useUpdateSubGoal,
} from '../lib/goals'
import { isTemp, tempId } from '../lib/optimistic'
import { useProjects } from '../lib/projects'
import { useAiOn } from '../lib/settings'
import { useCompletionStats } from '../lib/stats'
import { suggestionsKey, useSuggestions } from '../lib/suggestions'
import { useToast } from '../lib/toast'
import { useTodos } from '../lib/todos'
import type { Goal, Project, SubGoal, Todo } from '../lib/types'
import { useCurrentWorkspaceInfo } from '../lib/workspaces'

const LIMITS = [3, 5, 7] as const
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Goals, the home page (V2-UI-CHANGES §6): "{n} of {limit} slots" with the
 * Change limit popover, a numbered column per active goal (sub-goals, its
 * projects and to-dos), an open slot per unused spot, the archive and the
 * "Focus so far" tracker. The limit is this workspace's.
 */
export default function Goals() {
  const limit = useFocusLimit()
  const workspaceName = useCurrentWorkspaceInfo()?.name ?? 'this workspace'
  const { data: todos } = useTodos()
  const { data: projects } = useProjects('open', 'all')
  const { data: goals, isPending, isError } = useGoals()
  const createGoal = useCreateGoal()
  const moveGoal = useMoveGoal()
  const setLimit = useSetFocusLimit()
  const setStatus = useSetGoalStatus()
  const deleteGoal = useDeleteGoal()
  const snapshot = useLimitSnapshot()
  const toast = useToast()
  const { data: stats } = useCompletionStats()
  const aiOn = useAiOn()
  const qc = useQueryClient()
  const { data: suggestionData } = useSuggestions()
  // The suggestion run this visit started (by completing a goal or raising
  // the limit). When it's ready the panel opens; when it found nothing, one
  // quiet line; when it failed, nothing.
  const [watchRun, setWatchRun] = useState<number | null>(null)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)

  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  // Only one goal "⋯" menu at a time; the limit popover, adding a goal or a
  // sub-goal closes it.
  const [menuFor, setMenuFor] = useState<number | null>(null)
  const [limitOpen, setLimitOpen] = useState(false)
  const [archivedOpen, setArchivedOpen] = useState(false)
  // From search: open the archived section if needed, then scroll to the goal.
  const location = useLocation()
  const navigate = useNavigate()
  const fromSearch = location.state as { focusGoal?: number; archived?: boolean } | null
  const focusGoal = goals ? fromSearch?.focusGoal : undefined
  useEffect(() => {
    if (focusGoal === undefined) return
    if (fromSearch?.archived) setArchivedOpen(true)
    requestAnimationFrame(() => {
      const el = document.getElementById(`goal-${focusGoal}`)
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.add('is-target')
      window.setTimeout(() => el.classList.remove('is-target'), 2000)
    })
    navigate('.', { replace: true, state: null })
  }, [focusGoal])
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const active = activeOf(goals)
  const archived = (goals ?? []).filter((g) => g.status === 'archived')
  const atLimit = active.length >= limit
  // The nearest limit you can't drop to yet, e.g. 5 active → "Archive 2 goals to drop to 3."
  const blocked = LIMITS.filter((l) => l < active.length)
  const nearestBlocked = blocked.at(-1)
  const openSlots = goals ? Math.max(0, limit - active.length) : 0

  // Per goal: its non-archived projects and the open to-dos matched to it.
  const projectsOf = new Map<number, Project[]>()
  for (const p of projects ?? []) {
    if (p.goal_id === null || p.status === 'archived') continue
    projectsOf.set(p.goal_id, [...(projectsOf.get(p.goal_id) ?? []), p])
  }
  const todosOf = new Map<number, Todo[]>()
  for (const t of todos ?? []) {
    for (const m of t.matches) {
      if (m.type === 'goal') todosOf.set(m.id, [...(todosOf.get(m.id) ?? []), t])
    }
  }

  function create() {
    const title = newTitle.trim()
    if (!title) return
    createGoal.mutate({ tempId: tempId(), title })
    setNewTitle('')
    setAdding(false)
  }

  const suggestions = suggestionData?.data ?? []
  const latestRun = suggestionData?.latest_run
  const watched = watchRun !== null && latestRun?.id === watchRun ? latestRun : null
  const showSuggestions = suggestions.length > 0 && (suggestionsOpen || watched?.status === 'ready')

  /** A goal completion or limit increase answered with a suggestion run to wait for. */
  function watchSuggestionRun(response: unknown) {
    const runId = (response as { suggestion_run_id?: number | null } | undefined)?.suggestion_run_id
    if (!runId) return
    setWatchRun(runId)
    setSuggestionsOpen(false)
    qc.invalidateQueries({ queryKey: suggestionsKey })
  }

  function changeStatus(goal: Goal, action: 'complete' | 'archive') {
    setStatus.mutate(
      { id: goal.id, action },
      { onSuccess: action === 'complete' ? watchSuggestionRun : undefined }
    )
    toast(action === 'complete' ? 'Goal completed' : 'Goal archived', () => {
      const now = snapshot()
      if (now.active >= now.limit) {
        toast("Can't undo: you're at your limit.")
        return
      }
      setStatus.mutate({ id: goal.id, action: 'restore' })
    })
  }

  return (
    <section data-screen-label="Goals" className="goals">
      <header className="goals-header">
        <h1 className="goals-title">What you're climbing toward</h1>
        <div className="goals-limit">
          <span>
            {active.length} of {limit} slots
          </span>
          <span aria-hidden>·</span>
          <LimitPopover
            open={limitOpen}
            setOpen={(o) => {
              setLimitOpen(o)
              if (o) setMenuFor(null)
            }}
            limit={limit}
            active={active.length}
            workspaceName={workspaceName}
            nearestBlocked={nearestBlocked}
            disabled={!goals}
            onPick={(l) =>
              setLimit.mutate({ limit: l }, { onSuccess: l > limit ? watchSuggestionRun : undefined })
            }
          />
        </div>
        {(suggestions.length > 0 && !showSuggestions) || watched?.status === 'queued' || watched?.status === 'empty' ? (
          <div className="goals-header-notes">
            {suggestions.length > 0 && !showSuggestions && (
              <button className="btn btn-ghost suggestions-link" onClick={() => setSuggestionsOpen(true)}>
                Suggestions ({suggestions.length})
              </button>
            )}
            {watched?.status === 'queued' && <p className="hint">Looking for themes in your off-track backlog…</p>}
            {watched?.status === 'empty' && <p className="hint">No clear themes in your backlog yet.</p>}
          </div>
        ) : null}
      </header>

      {showSuggestions && (
        <GoalSuggestions
          suggestions={suggestions}
          atLimit={atLimit}
          onHide={() => {
            setSuggestionsOpen(false)
            setWatchRun(null)
          }}
        />
      )}

      {isError && <p className="muted">Couldn't load your goals.</p>}
      {!isPending && (
        <SortableList
          items={active}
          as="article"
          noun="goal"
          layout="grid"
          className="goal-grid"
          itemId={(g) => `goal-${g.id}`}
          itemClassName={() => 'goal-col'}
          isLocked={(g) => isTemp(g.id)}
          onMove={(id, placement, order) => moveGoal.mutate({ id, placement, order })}
          renderItem={(goal, handle) => (
            <GoalColumn
              goal={goal}
              number={active.findIndex((g) => g.id === goal.id) + 1}
              handle={handle}
              projects={projectsOf.get(goal.id) ?? []}
              todos={todosOf.get(goal.id) ?? []}
              menuOpen={menuFor === goal.id}
              setMenuOpen={(o) => setMenuFor(o ? goal.id : null)}
              onAddingSub={() => setMenuFor(null)}
              onComplete={() => changeStatus(goal, 'complete')}
              onArchive={() => changeStatus(goal, 'archive')}
              onDelete={() => deleteGoal(goal)}
            />
          )}
          after={Array.from({ length: openSlots }, (_, i) => (
            <div key={`slot-${i}`} className="goal-slot">
              <div className="goal-num is-open">
                <span>{String(active.length + i + 1).padStart(2, '0')}</span>
                <span className="goal-num-bar" aria-hidden />
              </div>
              <span className="goal-slot-label">Open slot</span>
              {i === 0 &&
                (adding ? (
                  <input
                    className="input on-bg"
                    autoFocus
                    placeholder="Name the goal and press Enter"
                    aria-label="New goal title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') create()
                      if (e.key === 'Escape') {
                        setAdding(false)
                        setNewTitle('')
                      }
                    }}
                    onBlur={() => {
                      if (!newTitle.trim()) setAdding(false)
                    }}
                  />
                ) : (
                  <button
                    className="btn btn-ghost goal-slot-add"
                    onClick={() => {
                      setAdding(true)
                      setMenuFor(null)
                    }}
                  >
                    <PlusIcon aria-hidden />
                    New goal
                  </button>
                ))}
            </div>
          ))}
        />
      )}

      {archived.length > 0 && (
        <div className="archived">
          <button
            className="btn btn-ghost archived-toggle"
            aria-expanded={archivedOpen}
            onClick={() => setArchivedOpen((o) => !o)}
          >
            {archivedOpen ? <CaretDownIcon aria-hidden /> : <CaretRightIcon aria-hidden />}
            Archived · {archived.length}
          </button>
          {archivedOpen && (
            <div className="archived-list">
              {archived.map((goal) => (
                <div key={goal.id} id={`goal-${goal.id}`} className="archived-row">
                  <span className="archived-title">{goal.title}</span>
                  <button
                    className="btn btn-ghost"
                    disabled={atLimit}
                    title={atLimit ? "You're at your limit" : undefined}
                    onClick={() => setStatus.mutate({ id: goal.id, action: 'restore' })}
                  >
                    <ArrowCounterClockwiseIcon size={16} aria-hidden />
                    Restore
                  </button>
                  <button className="btn btn-ghost muted" onClick={() => deleteGoal(goal)}>
                    <TrashIcon size={16} aria-hidden />
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <FocusTracker stats={stats} activeGoals={active} aiOn={aiOn} />

      <OffTrackBacklog confirm={setConfirm} />

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </section>
  )
}

/** "Change limit" and its popover: 3 / 5 / 7 goals for this workspace. */
function LimitPopover({
  open,
  setOpen,
  limit,
  active,
  workspaceName,
  nearestBlocked,
  disabled,
  onPick,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  limit: number
  active: number
  workspaceName: string
  nearestBlocked: number | undefined
  disabled: boolean
  onPick: (limit: 3 | 5 | 7) => void
}) {
  const ref = useRef<HTMLSpanElement>(null)
  useDismiss(open, ref, () => setOpen(false))
  return (
    <span className="limit-anchor" ref={ref}>
      <button
        type="button"
        className="link-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        Change limit
      </button>
      {open && (
        <div className="limit-popover" role="dialog" aria-label="Goal limit">
          <span className="limit-popover-label" id="limit-label">
            Goal limit in {workspaceName}
          </span>
          <div className="seg" role="radiogroup" aria-labelledby="limit-label">
            {LIMITS.map((l) => (
              <label key={l} className="seg-opt">
                <input
                  type="radio"
                  name="focus-limit"
                  value={l}
                  checked={limit === l}
                  disabled={l < active}
                  onChange={() => onPick(l)}
                />
                {l} goals
              </label>
            ))}
          </div>
          <p className="limit-popover-note">
            Up to {limit} goals can be active at once in {workspaceName}. To go lower, complete or archive a
            goal first.
          </p>
          {nearestBlocked !== undefined && (
            <p className="hint">
              Archive {plural(active - nearestBlocked, 'goal', 'goals')} to drop to {nearestBlocked}.
            </p>
          )}
        </div>
      )}
    </span>
  )
}

function GoalColumn({
  goal,
  number,
  handle,
  projects,
  todos,
  menuOpen,
  setMenuOpen,
  onAddingSub,
  onComplete,
  onArchive,
  onDelete,
}: {
  goal: Goal
  number: number
  handle: ReactNode
  projects: Project[]
  todos: Todo[]
  menuOpen: boolean
  setMenuOpen: (open: boolean) => void
  onAddingSub: () => void
  onComplete: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const update = useUpdateGoal()
  const addSub = useAddSubGoal()
  const moveSub = useMoveSubGoal()
  const [subAdding, setSubAdding] = useState(false)
  const [subDraft, setSubDraft] = useState('')
  const saved = !isTemp(goal.id)
  const menuRef = useRef<HTMLDivElement>(null)
  useDismiss(menuOpen, menuRef, () => setMenuOpen(false))

  const total = goal.sub_goals.length
  const done = goal.sub_goals.filter((s) => s.done).length
  const pct = total ? Math.round((done / total) * 100) : 0
  const pick = (fn: () => void) => () => {
    setMenuOpen(false)
    fn()
  }

  return (
    <>
      <div className="goal-top">
        <div className="goal-num">
          <span>{String(number).padStart(2, '0')}</span>
          <span className="goal-num-bar" aria-hidden />
        </div>
        <div className="goal-tools">
          {handle}
          <div className="goal-menu-anchor" ref={menuRef}>
            <button
              type="button"
              className="btn btn-ghost btn-icon goal-menu-btn"
              aria-label="Goal actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              disabled={!saved}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <DotsThreeIcon aria-hidden />
            </button>
            {menuOpen && (
              <div className="menu goal-menu" role="menu" aria-label="Goal actions">
                <button type="button" role="menuitem" className="menu-item is-accent" onClick={pick(onComplete)}>
                  <CheckCircleIcon aria-hidden />
                  Complete
                </button>
                <button type="button" role="menuitem" className="menu-item" onClick={pick(onArchive)}>
                  <ArchiveIcon aria-hidden />
                  Archive
                </button>
                <button type="button" role="menuitem" className="menu-item" onClick={pick(onDelete)}>
                  <TrashIcon aria-hidden />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AutoGrowTextarea
        value={goal.title}
        aria-label="Goal title"
        className="goal-title"
        allowEmpty={false}
        readOnly={!saved}
        onCommit={(title) => update.mutate({ id: goal.id, patch: { title: title.trim() } })}
      />

      <div className="goal-progress">
        <div
          className="progress"
          role="progressbar"
          aria-label="Sub-goals done"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span>{total ? `${done} of ${total} sub-goals` : 'No sub-goals yet'}</span>
      </div>

      <div className="goal-section">
        <h6 className="goal-section-label">Sub-goals</h6>
        <SortableList
          items={goal.sub_goals}
          noun="sub-goal"
          className="goal-subs"
          itemClassName={() => 'subgoal'}
          isLocked={(s) => isTemp(s.id)}
          onMove={(id, placement, order) => moveSub.mutate({ goalId: goal.id, id, placement, order })}
          renderItem={(sub, subHandle) => <SubGoalRow sub={sub} handle={subHandle} />}
        />
        {subAdding ? (
          <input
            className="input on-bg goal-sub-input"
            autoFocus
            placeholder="Add a sub-goal and press Enter"
            aria-label="Add a sub-goal"
            value={subDraft}
            onChange={(e) => setSubDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSubDraft('')
                setSubAdding(false)
                return
              }
              if (e.key !== 'Enter' || !subDraft.trim()) return
              addSub.mutate({ goalId: goal.id, tempId: tempId(), title: subDraft.trim() })
              setSubDraft('')
            }}
            onBlur={() => {
              if (!subDraft.trim()) setSubAdding(false)
            }}
          />
        ) : (
          <button
            type="button"
            className="text-btn"
            disabled={!saved}
            onClick={() => {
              setSubAdding(true)
              onAddingSub()
            }}
          >
            + Add sub-goal
          </button>
        )}
      </div>

      <div className="goal-section">
        <h6 className="goal-section-label">Projects</h6>
        {projects.length ? (
          <div className="goal-links">
            {projects.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="goal-link">
                <FolderSimpleIcon aria-hidden />
                <span>{p.title || 'Untitled project'}</span>
              </Link>
            ))}
          </div>
        ) : (
          <span className="goal-none">None yet</span>
        )}
      </div>

      <div className="goal-section">
        <h6 className="goal-section-label">{todos.length ? `To-dos · ${todos.length}` : 'To-dos'}</h6>
        {todos.length ? (
          <ul className={`goal-todos${todos.length > 5 ? ' is-faded' : ''}`}>
            {todos.map((t) => (
              <li key={t.id} className="goal-todo">
                {t.recurring ? <RepeatIcon aria-hidden /> : <CircleIcon aria-hidden />}
                <span>{t.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="goal-none">None yet</span>
        )}
      </div>
    </>
  )
}

function SubGoalRow({ sub, handle }: { sub: SubGoal; handle: ReactNode }) {
  const update = useUpdateSubGoal()
  const remove = useDeleteSubGoal()
  const saved = !isTemp(sub.id)
  const patch = (p: Partial<Pick<SubGoal, 'title' | 'done'>>) =>
    update.mutate({ goalId: sub.goal_id, id: sub.id, patch: p })

  return (
    <>
      <div className="row-main subgoal-main">
        {handle}
        <input
          type="checkbox"
          className="check check-16"
          aria-label="Sub-goal done"
          checked={sub.done}
          disabled={!saved}
          onChange={(e) => patch({ done: e.target.checked })}
        />
        <AutoGrowTextarea
          value={sub.title}
          aria-label="Sub-goal"
          className={`subgoal-title${sub.done ? ' is-done' : ''}`}
          allowEmpty={false}
          readOnly={!saved}
          onCommit={(title) => patch({ title: title.trim() })}
        />
        <button
          className="btn btn-ghost btn-icon tiny-icon muted"
          aria-label="Remove sub-goal"
          disabled={!saved}
          onClick={() => remove(sub)}
        >
          <XIcon aria-hidden />
        </button>
      </div>
    </>
  )
}
