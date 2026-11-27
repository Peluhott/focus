import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  CaretRightIcon,
  CheckCircleIcon,
  FolderSimpleIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react'
import AutoGrowTextarea from '../components/AutoGrowTextarea'
import ConfirmDialog, { type ConfirmRequest } from '../components/ConfirmDialog'
import FocusTracker from '../components/FocusTracker'
import GoalSuggestions from '../components/GoalSuggestions'
import OffTrackBacklog from '../components/OffTrackBacklog'
import NotesField from '../components/NotesField'
import SortableList from '../components/SortableList'
import { useMe } from '../lib/auth'
import {
  activeOf,
  useAddSubGoal,
  useCreateGoal,
  useDeleteGoal,
  useDeleteSubGoal,
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
import { useAiOn } from '../lib/settings'
import { useCompletionStats } from '../lib/stats'
import { suggestionsKey, useSuggestions } from '../lib/suggestions'
import { useToast } from '../lib/toast'
import type { Goal, SubGoal } from '../lib/types'

const LIMITS = [3, 5, 7] as const
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Goals, the home page (README §2): the slots and focus limit, goal cards,
 * the archive and the "Focus so far" tracker.
 */
export default function Goals() {
  const { data: user } = useMe()
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

  const limit = user?.focus_limit ?? 3
  const active = activeOf(goals)
  const archived = (goals ?? []).filter((g) => g.status === 'archived')
  const atLimit = active.length >= limit
  // The nearest limit you can't drop to yet, e.g. 5 active → "Archive 2 goals to drop to 3."
  const blocked = LIMITS.filter((l) => l < active.length)
  const nearestBlocked = blocked.at(-1)

  function create() {
    const title = newTitle.trim()
    if (!title) return
    createGoal.mutate({ tempId: tempId(), title })
    setNewTitle('')
    // Close the input when this one fills the last slot.
    if (active.length + 1 >= limit) setAdding(false)
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
    <section data-screen-label="Goals">
      <header className="goals-header">
        <h1 className="goals-title">What you're climbing toward</h1>
        <p className="goals-count">
          {active.length} of {limit} slots taken
        </p>
        <div className="slots">
          {Array.from({ length: limit }, (_, i) => {
            const goal = active[i]
            return (
              <div key={i} className={`slot${goal ? ' filled' : ''}`}>
                <span className="slot-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="slot-bar" aria-hidden />
                {goal ? (
                  <span className="slot-title">{goal.title}</span>
                ) : (
                  <button className="btn btn-ghost slot-add" disabled={!goals} onClick={() => setAdding(true)}>
                    <PlusIcon aria-hidden />
                    Open slot
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className="limit-control">
          <span className="limit-label" id="limit-label">
            Limit
          </span>
          <div className="seg" role="radiogroup" aria-labelledby="limit-label">
            {LIMITS.map((l) => (
              <label key={l} className="seg-opt">
                <input
                  type="radio"
                  name="focus-limit"
                  value={l}
                  checked={limit === l}
                  disabled={l < active.length || !user}
                  onChange={() =>
                    setLimit.mutate({ limit: l }, { onSuccess: l > limit ? watchSuggestionRun : undefined })
                  }
                />
                {l}
              </label>
            ))}
          </div>
        </div>
        {atLimit && (
          <p className="note">You're at your limit. Complete or archive a goal, or raise your limit.</p>
        )}
        {nearestBlocked !== undefined && (
          <p className="hint">
            Archive {plural(active.length - nearestBlocked, 'goal', 'goals')} to drop to {nearestBlocked}.
          </p>
        )}
        {suggestions.length > 0 && !showSuggestions && (
          <button className="btn btn-ghost suggestions-link" onClick={() => setSuggestionsOpen(true)}>
            Suggestions ({suggestions.length})
          </button>
        )}
        {watched?.status === 'queued' && <p className="hint">Looking for themes in your off-track backlog…</p>}
        {watched?.status === 'empty' && <p className="hint">No clear themes in your backlog yet.</p>}
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

      {adding && !atLimit && (
        <div className="new-goal">
          <input
            className="input"
            autoFocus
            placeholder="Goal title, then Enter"
            aria-label="New goal title"
            style={{ fontSize: 16, minHeight: 44 }}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create()
              if (e.key === 'Escape') {
                setAdding(false)
                setNewTitle('')
              }
            }}
          />
          <button
            className="btn btn-ghost"
            onClick={() => {
              setAdding(false)
              setNewTitle('')
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {isError && <p className="muted centered">Couldn't load your goals.</p>}
      <SortableList
        items={active}
        as="article"
        noun="goal"
        layout="grid"
        className="goal-list"
        itemId={(g) => `goal-${g.id}`}
        itemClassName={() => 'card goal-card'}
        isLocked={(g) => isTemp(g.id)}
        onMove={(id, placement, order) => moveGoal.mutate({ id, placement, order })}
        renderItem={(goal, handle) => (
          <GoalCard
            goal={goal}
            handle={handle}
            onComplete={() => changeStatus(goal, 'complete')}
            onArchive={() => changeStatus(goal, 'archive')}
            onDelete={() => deleteGoal(goal)}
          />
        )}
      />
      {!isPending && active.length === 0 && <p className="empty muted centered">No active goals yet.</p>}

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

function GoalCard({
  goal,
  handle,
  onComplete,
  onArchive,
  onDelete,
}: {
  goal: Goal
  handle: ReactNode
  onComplete: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const update = useUpdateGoal()
  const addSub = useAddSubGoal()
  const moveSub = useMoveSubGoal()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [subDraft, setSubDraft] = useState('')
  const saved = !isTemp(goal.id)

  const total = goal.sub_goals.length
  const done = goal.sub_goals.filter((s) => s.done).length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <>
      <div className="goal-head">
        {handle}
        <div className="goal-head-text">
          <AutoGrowTextarea
            value={goal.title}
            aria-label="Goal title"
            className="goal-title"
            allowEmpty={false}
            readOnly={!saved}
            onCommit={(title) => update.mutate({ id: goal.id, patch: { title: title.trim() } })}
          />
          <div className="goal-meta">
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
            <span className="meta-icon">
              <FolderSimpleIcon aria-hidden />
              {plural(goal.projects_count, 'linked project', 'linked projects')}
            </span>
          </div>
        </div>
      </div>

      <div className="goal-indent">
        <button
          className="btn btn-ghost small-toggle"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((o) => !o)}
        >
          {detailsOpen ? <CaretDownIcon aria-hidden /> : <CaretRightIcon aria-hidden />}
          Details
        </button>
        {detailsOpen && (
          <NotesField
            className="on-bg"
            style={{ marginTop: 'var(--space-2)', minHeight: 80 }}
            placeholder="Why this goal matters, what done looks like. Markdown works."
            aria-label="Goal details"
            value={goal.details}
            disabled={!saved}
            onCommit={(details) => update.mutate({ id: goal.id, patch: { details } })}
          />
        )}
      </div>

      <div className="goal-indent">
        <SortableList
          items={goal.sub_goals}
          noun="sub-goal"
          itemClassName={() => 'subgoal'}
          isLocked={(s) => isTemp(s.id)}
          onMove={(id, placement, order) => moveSub.mutate({ goalId: goal.id, id, placement, order })}
          renderItem={(sub, subHandle) => <SubGoalRow sub={sub} handle={subHandle} />}
        />
        <input
          className="input on-bg"
          style={{ marginTop: 6 }}
          placeholder="Add a sub-goal and press Enter"
          aria-label="Add a sub-goal"
          disabled={!saved}
          value={subDraft}
          onChange={(e) => setSubDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !subDraft.trim()) return
            addSub.mutate({ goalId: goal.id, tempId: tempId(), title: subDraft.trim() })
            setSubDraft('')
          }}
        />
      </div>

      <div className="goal-indent goal-actions">
        <button className="btn btn-secondary" disabled={!saved} onClick={onComplete}>
          <CheckCircleIcon size={16} aria-hidden />
          Complete
        </button>
        <button className="btn btn-ghost" disabled={!saved} onClick={onArchive}>
          <ArchiveIcon size={16} aria-hidden />
          Archive
        </button>
        <button className="btn btn-ghost muted" disabled={!saved} onClick={onDelete}>
          <TrashIcon size={16} aria-hidden />
          Delete
        </button>
      </div>
    </>
  )
}

function SubGoalRow({ sub, handle }: { sub: SubGoal; handle: ReactNode }) {
  const update = useUpdateSubGoal()
  const remove = useDeleteSubGoal()
  const [open, setOpen] = useState(false)
  const saved = !isTemp(sub.id)
  const patch = (p: Partial<Pick<SubGoal, 'title' | 'details' | 'done'>>) =>
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
          className="btn btn-ghost btn-icon tiny-icon"
          aria-label={open ? 'Hide sub-goal details' : 'Show sub-goal details'}
          aria-expanded={open}
          disabled={!saved}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <CaretDownIcon aria-hidden /> : <CaretRightIcon aria-hidden />}
        </button>
        <button
          className="btn btn-ghost btn-icon tiny-icon muted"
          aria-label="Remove sub-goal"
          disabled={!saved}
          onClick={() => remove(sub)}
        >
          <XIcon aria-hidden />
        </button>
      </div>
      {open && (
        <NotesField
          className="on-bg subgoal-details"
          placeholder="Details. Markdown works."
          aria-label="Sub-goal details"
          value={sub.details}
          onCommit={(details) => patch({ details })}
        />
      )}
    </>
  )
}
