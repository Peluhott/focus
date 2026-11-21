import type { HttpContext } from '@adonisjs/core/http'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import db from '@adonisjs/lucid/services/db'
import AppError from '#exceptions/app_error'
import Goal from '#models/goal'
import Project from '#models/project'
import { bottomPosition, inList, positionFor, wantsMove } from '#services/ordering'
import { paginateByPosition } from '#services/paginate'
import {
  createProjectValidator,
  listProjectsValidator,
  updateProjectValidator,
} from '#validators/project'

/** All projects share one manual order; filters just show a slice of it. */
const allProjects = () => Project.query()

/**
 * Projects with their goal, open-task count and next due date: the earliest
 * of the project's own due date and its pending tasks' due dates.
 */
function withSummary(query: ModelQueryBuilderContract<typeof Project>) {
  return query
    .select('projects.*')
    .select(
      db.raw(
        `LEAST(projects.due_date, (SELECT MIN(t.due_date) FROM tasks t
           WHERE t.project_id = projects.id AND t.status = 'pending')) AS next_due`
      )
    )
    .withCount('tasks', (q) => q.where('status', 'pending').as('open_task_count'))
    .preload('goal', (q) => q.select('id', 'title', 'status'))
}

function view(project: Project) {
  const { goal, ...rest } = project.serialize()
  return {
    ...rest,
    goal: goal ? { id: goal.id, title: goal.title, status: goal.status } : null,
    open_task_count: Number(project.$extras.open_task_count ?? 0),
    next_due: project.$extras.next_due ?? null,
  }
}

async function load(id: number | string) {
  return withSummary(Project.query().where('projects.id', id)).firstOrFail()
}

/** A project can only be linked to an active goal (or to none). */
async function assertLinkable(goalId: number | null | undefined) {
  if (goalId == null) return
  const goal = await Goal.find(goalId)
  if (!goal || goal.status !== 'active') {
    throw AppError.validation('A project can only be linked to an active goal.')
  }
}

export default class ProjectsController {
  /** GET /projects?status=&goal_id= (archived hidden unless asked for). */
  async index({ request }: HttpContext) {
    const filters = await listProjectsValidator.validate(request.qs())
    const query = withSummary(Project.query())
    if (!filters.status) query.whereNot('projects.status', 'archived')
    else if (filters.status !== 'all') query.where('projects.status', filters.status)
    if (filters.goal_id === 'none') query.whereNull('projects.goal_id')
    else if (filters.goal_id) query.where('projects.goal_id', Number(filters.goal_id))

    const { rows, nextCursor } = await paginateByPosition<Project>(query, filters, 'projects')
    return { data: rows.map(view), next_cursor: nextCursor }
  }

  async show({ params }: HttpContext) {
    return view(await load(params.id))
  }

  /** POST /projects: added at the bottom, status planning unless given. */
  async store({ request, response }: HttpContext) {
    const input = await request.validateUsing(createProjectValidator)
    await assertLinkable(input.goal_id)
    const project = await inList('projects', async (trx) =>
      Project.create(
        {
          title: input.title ?? '',
          details: input.details ?? '',
          status: input.status ?? 'planning',
          goalId: input.goal_id ?? null,
          dueDate: input.due_date ?? null,
          position: await bottomPosition(allProjects, trx),
        },
        { client: trx }
      )
    )
    return response.created(view(await load(project.id)))
  }

  async update({ params, request }: HttpContext) {
    const project = await Project.findOrFail(params.id)
    const input = await request.validateUsing(updateProjectValidator)

    if (input.title !== undefined) project.title = input.title
    if (input.details !== undefined) project.details = input.details
    if (input.status !== undefined) project.status = input.status
    if (input.due_date !== undefined) project.dueDate = input.due_date
    if (input.goal_id !== undefined && input.goal_id !== project.goalId) {
      await assertLinkable(input.goal_id)
      project.goalId = input.goal_id
    }
    if (wantsMove(input)) {
      await inList('projects', async (trx) => {
        project.position = await positionFor(allProjects, input, project.id, trx)
        await project.useTransaction(trx).save()
      })
    } else {
      await project.save()
    }
    return view(await load(project.id))
  }

  /** DELETE /projects/:id: its tasks go with it. */
  async destroy({ params, response }: HttpContext) {
    const project = await Project.findOrFail(params.id)
    await project.delete()
    return response.noContent()
  }
}
