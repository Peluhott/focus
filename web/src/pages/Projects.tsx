import { CaretRightIcon, PlusIcon, TargetIcon } from '@phosphor-icons/react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import SortableList from '../components/SortableList'
import { shortDate } from '../lib/dates'
import { activeOf, useGoals } from '../lib/goals'
import { useCreateProject, useMoveProject, useProjects } from '../lib/projects'
import { PROJECT_STATUS_LABEL, type ProjectStatus } from '../lib/types'

const STATUS_OPTIONS: [string, string][] = [
  ['open', 'All but archived'],
  ...(Object.entries(PROJECT_STATUS_LABEL) as [ProjectStatus, string][]),
]

/** Projects list (README §4). Filters live in the URL, so Back keeps them. */
export default function Projects() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'open'
  const goal = params.get('goal') ?? 'all'
  const { data: projects, isPending, isError } = useProjects(status, goal)
  const { data: goals } = useGoals()
  const move = useMoveProject(status, goal)
  const create = useCreateProject()
  const navigate = useNavigate()

  function setFilter(name: 'status' | 'goal', value: string, fallback: string) {
    const next = new URLSearchParams(params)
    if (value === fallback) next.delete(name)
    else next.set(name, value)
    setParams(next, { replace: true })
  }

  function newProject() {
    create.mutate(undefined, {
      onSuccess: (p) => navigate(`/projects/${p.id}`, { state: { isNew: true } }),
    })
  }

  return (
    <section data-screen-label="Projects">
      <h1 className="page-title centered" style={{ marginBottom: 'var(--space-6)' }}>
        Projects
      </h1>
      <div className="controls-row centered-row" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="field">
          <label htmlFor="fstatus">Status</label>
          <select
            id="fstatus"
            className="input"
            style={{ width: 'auto' }}
            value={status}
            onChange={(e) => setFilter('status', e.target.value, 'open')}
          >
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fgoal">Goal</label>
          <select
            id="fgoal"
            className="input"
            style={{ width: 'auto', maxWidth: 260 }}
            value={goal}
            onChange={(e) => setFilter('goal', e.target.value, 'all')}
          >
            <option value="all">All goals</option>
            <option value="none">No goal</option>
            {activeOf(goals).map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.title}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" style={{ minHeight: 36 }} disabled={create.isPending} onClick={newProject}>
          <PlusIcon size={16} aria-hidden />
          New project
        </button>
      </div>

      {isError && <p className="muted centered">Couldn't load your projects.</p>}
      {projects && (
        <SortableList
          items={projects}
          noun="project"
          className="project-list"
          itemClassName={() => 'project-row'}
          onMove={(id, placement, order) => move.mutate({ id, placement, order })}
          renderItem={(p, handle) => (
            <div className="project-row-inner" onClick={() => navigate(`/projects/${p.id}`)}>
              {handle}
              <div className="project-row-text">
                <Link to={`/projects/${p.id}`} className="project-row-title" onClick={(e) => e.stopPropagation()}>
                  {p.title || 'Untitled project'}
                </Link>
                <div className="project-meta">
                  <span className={`tag ${p.status === 'active' ? 'tag-accent' : 'tag-neutral'}`}>
                    {PROJECT_STATUS_LABEL[p.status]}
                  </span>
                  {p.goal && (
                    <span className="meta-icon">
                      <TargetIcon aria-hidden />
                      {p.goal.title}
                    </span>
                  )}
                  <span>
                    {p.open_task_count} open {p.open_task_count === 1 ? 'task' : 'tasks'}
                  </span>
                  {p.next_due && <span>Next due {shortDate(p.next_due)}</span>}
                </div>
              </div>
              <CaretRightIcon className="row-caret" aria-hidden />
            </div>
          )}
        />
      )}
      {!isPending && projects?.length === 0 && (
        <p className="muted centered">No projects match these filters.</p>
      )}
    </section>
  )
}
