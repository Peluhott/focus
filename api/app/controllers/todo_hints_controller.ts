import type { HttpContext } from '@adonisjs/core/http'
import AppError from '#exceptions/app_error'
import Todo from '#models/todo'
import TodoHintRun from '#models/todo_hint_run'
import { aiActive, queueTodoCheck } from '#services/alignment/triggers'
import { startHintRun } from '#services/hints/triggers'
import { activeGoalIds, setMatches, withMatchViewOne } from '#services/matches'
import { inList, positionFor, topPosition } from '#services/ordering'
import { findInWs } from '#services/scoped'
import { addHintStepValidator, requestHintValidator } from '#validators/hint'
import { openTodosOf, todosList } from './todos_controller.js'

/**
 * "Help me start" on a to-do (designhandoff START-SMALL.md): the AI gives
 * one small first step. The run is built in the worker; the web polls
 * GET /todos/:id/hint while its status is "queued".
 */
export default class TodoHintsController {
  /** GET /todos/:id/hint: the latest run for the to-do, or null. */
  async show({ params, workspace }: HttpContext) {
    const todo = await findInWs(Todo, workspace, params.id)
    const run = await TodoHintRun.query()
      .where('todo_id', todo.id)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .first()
    return { run: run?.serialize() ?? null }
  }

  /**
   * POST /todos/:id/hint: 202 with a queued run, or 200 with the last one
   * when the to-do is unchanged (pass force: true for "Another idea").
   * 409 ai_disabled while the workspace's AI is off: nothing is sent.
   */
  async store({ params, request, response, workspace }: HttpContext) {
    const todo = await findInWs(Todo, workspace, params.id)
    const { force } = await request.validateUsing(requestHintValidator)
    if (!(await aiActive(workspace.id))) {
      throw new AppError('ai_disabled', 'Turn on the AI in Settings to get a first step.', 409)
    }
    if (todo.done) throw AppError.validation('Completed to-dos have no first step.')

    const { run, reused } = await startHintRun(todo, { force })
    response.status(reused ? 200 : 202)
    return { run: run.serialize() }
  }

  /**
   * POST /todos/:id/hint/add { title }: "Add as to-do". One one-time to-do,
   * directly above the source while it's an open one-time to-do, else on
   * top (so it lands in the one-time list). If the source is aligned, the
   * new one gets the same goals (as an AI result, so a later re-check can
   * still change it); otherwise it gets the usual check. Undo is
   * DELETE /todos/:id.
   */
  async add({ params, request, response, workspace }: HttpContext) {
    const source = await findInWs(Todo, workspace, params.id)
    const { title } = await request.validateUsing(addHintStepValidator)
    const ai = await aiActive(workspace.id)
    const goalIds = source.alignmentStatus === 'aligned' ? await activeGoalIds(source.id) : []
    const inherit = goalIds.length > 0
    const check = ai && !inherit
    const openOneTime = !source.done && !source.recurring

    const todo = await inList(todosList(workspace), async (trx) => {
      const position = openOneTime
        ? await positionFor(openTodosOf(workspace), { before_id: source.id }, 0, trx)
        : await topPosition(openTodosOf(workspace), trx)
      const row = await Todo.create(
        {
          workspaceId: workspace.id,
          title,
          notes: '',
          date: openOneTime ? source.date : null,
          recurring: false,
          position,
          done: false,
          alignmentStatus: inherit ? 'aligned' : check ? 'pending' : null,
          alignmentSource: inherit ? 'ai' : null,
        },
        { client: trx }
      )
      if (inherit) {
        await setMatches(
          row.id,
          goalIds.map((id) => ({ id, confidence: null })),
          trx
        )
      }
      return row
    })

    if (check) await queueTodoCheck(todo.id)
    await todo.refresh()
    return response.created(await withMatchViewOne(todo))
  }
}
