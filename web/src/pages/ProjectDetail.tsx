import { useState, type ReactNode } from 'react'
import { ArrowLeftIcon, CalendarBlankIcon, CaretRightIcon, TrashIcon } from '@phosphor-icons/react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import AutoGrowTextarea from '../components/AutoGrowTextarea'
import NotesField from '../components/NotesField'
import ProjectFiles from '../components/ProjectFiles'
import SortableList from '../components/SortableList'
import { shortDate } from '../lib/dates'
import { activeOf, useGoals } from '../lib/goals'
import { isTemp, tempId } from '../lib/optimistic'
import {
  useAddTask,
  useDeleteProject,
  useDeleteTask,
  useMoveTask,
  useProject,
  useTasks,
  useUpdateProject,
  useUpdateTask,
  type ProjectPatch,
} from '../lib/projects'
import { PROJECT_STATUS_LABEL, type ProjectStatus, type Task } from '../lib/types'

/** Project detail (README §5): fields, details and the task list. */

/** Projects whose "Complete" list is open (session only; collapsed by default). */
const openComplete = new Set<number>()

export default function ProjectDetail() {
  const id = Number(useParams().id)
  const location = useLocation()
  const navigate = useNavigate()
  const isNew = !!(location.state as { isNew?: boolean } | null)?.isNew

  const { data: project, isError } = useProject(id)
  const { data: tasks } = useTasks(id)
  const { data: goals } = useGoals()
  const update = useUpdateProject()
  const remove = useDeleteProject()
  const addTask = useAddTask(id)
  const moveTask = useMoveTask(id)
  const [taskDraft, setTaskDraft] = useState('')
  const [, rerender] = useState(0)
  const completeOpen = openComplete.has(id)

  if (isError) {
    return (
      <section className="project-detail">
        <BackLink />
        <p className="muted" style={{ marginTop: 'var(--space-4)' }}>
          This project doesn't exist.
        </p>
      </section>
    )
  }
  if (!project) return null

  const set = (patch: ProjectPatch) => update.mutate({ id, patch })
  const pending = (tasks ?? []).filter((t) => t.status === 'pending')
  const complete = (tasks ?? []).filter((t) => t.status === 'complete')
  const activeGoals = activeOf(goals)
  const linkedInactive = project.goal && project.goal.status !== 'active' ? project.goal : null

  return (
    <section data-screen-label="Project detail" className="project-detail">
      <BackLink />
      <AutoGrowTextarea
        key={project.id}
        value={project.title}
        placeholder="Untitled project"
        aria-label="Project title"
        className="project-title"
        autoFocus={isNew}
        onCommit={(title) => set({ title: title.trim() })}
      />

      <div className="fields-row">
        <div className="field">
          <label htmlFor="pstatus">Status</label>
          <select
            id="pstatus"
            className="input"
            style={{ width: 'auto' }}
            value={project.status}
            onChange={(e) => set({ status: e.target.value as ProjectStatus })}
          >
            {(Object.entries(PROJECT_STATUS_LABEL) as [ProjectStatus, string][]).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pgoal">Goal</label>
          <select
            id="pgoal"
            className="input"
            style={{ width: 'auto', maxWidth: 280 }}
            value={project.goal_id ?? ''}
            onChange={(e) => {
              const goalId = e.target.value ? Number(e.target.value) : null
              const goal = activeGoals.find((g) => g.id === goalId)
              update.mutate({
                id,
                patch: { goal_id: goalId },
                goal: goal ? { id: goal.id, title: goal.title, status: goal.status } : null,
              })
            }}
          >
            <option value="">None</option>
            {linkedInactive && <option value={linkedInactive.id}>{linkedInactive.title} (not active)</option>}
            {activeGoals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pdue">Due date</label>
          <input
            id="pdue"
            type="date"
            className="input"
            style={{ width: 'auto' }}
            value={project.due_date ?? ''}
            onChange={(e) => set({ due_date: e.target.value || null })}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="pdetails">Details</label>
        <NotesField
          id="pdetails"
          style={{ minHeight: 140 }}
          placeholder="Overview, links, decisions and notes. Markdown works."
          value={project.details}
          onCommit={(details) => set({ details })}
        />
      </div>

      <ProjectFiles projectId={id} />

      <h3 style={{ margin: 'var(--space-8) 0 var(--space-3)' }}>Tasks</h3>
      <input
        className="input"
        style={{ fontSize: 15, minHeight: 40 }}
        placeholder="Add a task and press Enter"
        aria-label="Add a task"
        value={taskDraft}
        onChange={(e) => setTaskDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || !taskDraft.trim()) return
          addTask.mutate({ tempId: tempId(), title: taskDraft.trim() })
          setTaskDraft('')
        }}
      />

      <h6 className="section-label">Pending · {pending.length}</h6>
      <SortableList
        items={pending}
        noun="task"
        itemClassName={() => 'task-row'}
        isLocked={(t) => isTemp(t.id)}
        onMove={(taskId, placement, order) => moveTask.mutate({ id: taskId, placement, order })}
        renderItem={(task, handle) => <TaskRow task={task} handle={handle} />}
      />
      {tasks && pending.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Nothing pending.</p>}

      <button
        type="button"
        className="complete-toggle"
        aria-expanded={completeOpen}
        onClick={() => {
          const next = !completeOpen
          if (next) openComplete.add(id)
          else openComplete.delete(id)
          rerender((n) => n + 1)
        }}
      >
        <CaretRightIcon size={14} aria-hidden className="complete-caret" />
        <h6 className="section-label">Complete · {complete.length}</h6>
      </button>
      {completeOpen && (
        <div>
          {complete.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 'var(--space-8)' }}>
        <button
          className="btn btn-ghost muted"
          onClick={() => {
            // Delete with Undo (UNDO.md); Undo brings it back on the Projects list.
            remove({ id, title: project.title || 'Untitled project' })
            navigate('/projects')
          }}
        >
          <TrashIcon size={16} aria-hidden />
          Delete project
        </button>
      </div>
    </section>
  )
}

function BackLink() {
  return (
    <Link to="/projects" className="back-link">
      <ArrowLeftIcon aria-hidden />
      Projects
    </Link>
  )
}

/** A task row. Pending rows get a drag handle; complete rows are struck through. Both can be deleted (with Undo). */
function TaskRow({ task, handle }: { task: Task; handle?: ReactNode }) {
  const update = useUpdateTask(task.project_id)
  const remove = useDeleteTask(task.project_id)
  const [open, setOpen] = useState(false)
  const saved = !isTemp(task.id)
  const isComplete = task.status === 'complete'

  return (
    <div className={isComplete ? 'task-row is-complete' : undefined}>
      <div className="row-main task-main">
        {handle}
        <input
          type="checkbox"
          className="check check-17"
          aria-label={isComplete ? 'Mark task pending' : 'Complete task'}
          checked={isComplete}
          disabled={!saved}
          onChange={(e) =>
            update.mutate({ id: task.id, patch: { status: e.target.checked ? 'complete' : 'pending' } })
          }
        />
        {isComplete ? (
          <span className="task-title is-done">{task.title}</span>
        ) : (
          <AutoGrowTextarea
            value={task.title}
            aria-label="Task"
            className="task-title"
            allowEmpty={false}
            readOnly={!saved}
            onCommit={(title) => update.mutate({ id: task.id, patch: { title: title.trim() } })}
          />
        )}
        {task.due_date && !isComplete && (
          <span className="tag tag-neutral" style={{ whiteSpace: 'nowrap' }}>
            {shortDate(task.due_date)}
          </span>
        )}
        {!isComplete && (
          <button
            className="btn btn-ghost btn-icon row-icon"
            aria-label="Due date and details"
            aria-expanded={open}
            disabled={!saved}
            onClick={() => setOpen((o) => !o)}
          >
            <CalendarBlankIcon size={18} aria-hidden />
          </button>
        )}
        <button
          className="btn btn-ghost btn-icon row-icon muted"
          aria-label="Delete task"
          disabled={!saved}
          onClick={() => remove(task)}
        >
          <TrashIcon size={18} aria-hidden />
        </button>
      </div>
      {open && !isComplete && (
        <div className="row-panel">
          <NotesField
            className="on-bg"
            style={{ minHeight: 64 }}
            placeholder="Details"
            aria-label="Task details"
            value={task.details}
            onCommit={(details) => update.mutate({ id: task.id, patch: { details } })}
          />
          <div className="row-panel-actions">
            <input
              type="date"
              className="input on-bg"
              aria-label="Due date"
              style={{ width: 'auto' }}
              value={task.due_date ?? ''}
              onChange={(e) => update.mutate({ id: task.id, patch: { due_date: e.target.value || null } })}
            />
            {task.due_date && (
              <button className="btn btn-ghost" onClick={() => update.mutate({ id: task.id, patch: { due_date: null } })}>
                Clear date
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
