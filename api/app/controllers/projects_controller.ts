import type { HttpContext } from '@adonisjs/core/http'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import db from '@adonisjs/lucid/services/db'
import AppError from '#exceptions/app_error'
import Goal from '#models/goal'
import Project from '#models/project'
import ProjectFile from '#models/project_file'
import { bottomPosition, inList, positionFor, wantsMove } from '#services/ordering'
import { paginateByPosition } from '#services/paginate'
import { findInWs, inWs } from '#services/scoped'
import type Workspace from '#models/workspace'
import { queueFileDeletes } from '#services/storage/deletes'
import {
  createProjectValidator,
  listProjectsValidator,
  updateProjectValidator,
} from '#validators/project'

/** A workspace's projects share one manual order; filters just show a slice of it. */
const projectsOf = (ws: Workspace) => () => inWs(Project, ws)
const projectsList = (ws: Workspace) => `projects:${ws.id}`

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

async function load(ws: Workspace, id: number | string) {
  return withSummary(inWs(Project, ws).where('projects.id', id)).firstOrFail()
}

/** A project can only be linked to an active goal in its workspace (or to none). */
async function assertLinkable(ws: Workspace, goalId: number | null | undefined) {
  if (goalId == null) return
  const goal = await inWs(Goal, ws).where('id', goalId).first()
  if (!goal || goal.status !== 'active') {
    throw AppError.validation('A project can only be linked to an active goal.')
  }
}

export default class ProjectsController {
  /** GET /projects?status=&goal_id= (archived hidden unless asked for). */
  async index({ request, workspace }: HttpContext) {
    const filters = await listProjectsValidator.validate(request.qs())
    const query = withSummary(inWs(Project, workspace))
    if (!filters.status) query.whereNot('projects.status', 'archived')
    else if (filters.status !== 'all') query.where('projects.status', filters.status)
    if (filters.goal_id === 'none') query.whereNull('projects.goal_id')
    else if (filters.goal_id) query.where('projects.goal_id', Number(filters.goal_id))

    const { rows, nextCursor } = await paginateByPosition<Project>(query, filters, 'projects')
    return { data: rows.map(view), next_cursor: nextCursor }
  }

  async show({ params, workspace }: HttpContext) {
    return view(await load(workspace, params.id))
  }

  /** POST /projects: added at the bottom, status planning unless given. */
  async store({ request, response, workspace }: HttpContext) {
    const input = await request.validateUsing(createProjectValidator)
    await assertLinkable(workspace, input.goal_id)
    const project = await inList(projectsList(workspace), async (trx) =>
      Project.create(
        {
          workspaceId: workspace.id,
          title: input.title ?? '',
          details: input.details ?? '',
          status: input.status ?? 'planning',
          goalId: input.goal_id ?? null,
          dueDate: input.due_date ?? null,
          position: await bottomPosition(projectsOf(workspace), trx),
        },
        { client: trx }
      )
    )
    return response.created(view(await load(workspace, project.id)))
  }

  async update({ params, request, workspace }: HttpContext) {
    const project = await findInWs(Project, workspace, params.id)
    const input = await request.validateUsing(updateProjectValidator)

    if (input.title !== undefined) project.title = input.title
    if (input.details !== undefined) project.details = input.details
    if (input.status !== undefined) project.status = input.status
    if (input.due_date !== undefined) project.dueDate = input.due_date
    if (input.goal_id !== undefined && input.goal_id !== project.goalId) {
      await assertLinkable(workspace, input.goal_id)
      project.goalId = input.goal_id
    }
    if (wantsMove(input)) {
      await inList(projectsList(workspace), async (trx) => {
        project.position = await positionFor(projectsOf(workspace), input, project.id, trx)
        await project.useTransaction(trx).save()
      })
    } else {
      await project.save()
    }
    return view(await load(workspace, project.id))
  }

  /**
   * DELETE /projects/:id: its tasks and file records go with it (cascade);
   * deleting the files from Cloudinary is queued for the worker.
   */
  async destroy({ params, response, workspace }: HttpContext) {
    const project = await findInWs(Project, workspace, params.id)
    const files = await ProjectFile.query()
      .where('project_id', project.id)
      .select('cloudinary_public_id', 'resource_type')
    await project.delete()
    await queueFileDeletes(files)
    return response.noContent()
  }
}
