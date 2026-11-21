import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Project from '#models/project'
import Task from '#models/task'
import { bottomPosition, inList, positionFor, wantsMove } from '#services/ordering'
import { createTaskValidator, updateTaskValidator } from '#validators/project'

/** Pending tasks of one project: the list drag-and-drop orders. */
const pendingOf = (projectId: number) => () =>
  Task.query().where('project_id', projectId).where('status', 'pending')

export default class TasksController {
  /**
   * GET /projects/:id/tasks: pending tasks in your order, then completed
   * ones, most recently completed first. Completed tasks never disappear.
   */
  async index({ params }: HttpContext) {
    const project = await Project.findOrFail(params.id)
    const pending = await pendingOf(project.id)().orderBy('position', 'asc').orderBy('id', 'asc')
    const complete = await Task.query()
      .where('project_id', project.id)
      .where('status', 'complete')
      .orderBy('completed_at', 'desc')
      .orderBy('id', 'desc')
    return { data: [...pending, ...complete].map((t) => t.serialize()), next_cursor: null }
  }

  /** POST /projects/:id/tasks: appended to Pending. */
  async store({ params, request, response }: HttpContext) {
    const project = await Project.findOrFail(params.id)
    const input = await request.validateUsing(createTaskValidator)
    const task = await inList(`tasks:${project.id}`, async (trx) =>
      Task.create(
        {
          projectId: project.id,
          title: input.title,
          details: input.details ?? '',
          dueDate: input.due_date ?? null,
          status: 'pending',
          position: await bottomPosition(pendingOf(project.id), trx),
        },
        { client: trx }
      )
    )
    await task.refresh()
    return response.created(task.serialize())
  }

  /**
   * PATCH /tasks/:id. Completing stamps completed_at (top of Complete);
   * moving back to pending puts it at the end of Pending.
   */
  async update({ params, request }: HttpContext) {
    const task = await Task.findOrFail(params.id)
    const input = await request.validateUsing(updateTaskValidator)

    if (input.title !== undefined) task.title = input.title
    if (input.details !== undefined) task.details = input.details
    if (input.due_date !== undefined) task.dueDate = input.due_date
    const reopening = input.status === 'pending' && task.status !== 'pending'
    if (input.status !== undefined && input.status !== task.status) {
      task.status = input.status
      task.completedAt = input.status === 'complete' ? DateTime.now() : null
    }
    if (reopening || wantsMove(input)) {
      await inList(`tasks:${task.projectId}`, async (trx) => {
        task.position = wantsMove(input)
          ? await positionFor(pendingOf(task.projectId), input, task.id, trx)
          : await bottomPosition(pendingOf(task.projectId), trx)
        await task.useTransaction(trx).save()
      })
    } else {
      await task.save()
    }
    return task.serialize()
  }

  async destroy({ params, response }: HttpContext) {
    const task = await Task.findOrFail(params.id)
    await task.delete()
    return response.noContent()
  }
}
