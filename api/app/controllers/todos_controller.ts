import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AppError from '#exceptions/app_error'
import Goal from '#models/goal'
import OffTrackItem from '#models/off_track_item'
import Todo from '#models/todo'
import { aiActive, queueTodoCheck } from '#services/alignment/triggers'
import { latestCompletion, logCompletion, removeLatestCompletion } from '#services/completions'
import { setMatches, withMatchView, withMatchViewOne, type GoalLink } from '#services/matches'
import { inList, positionFor, topPosition, wantsMove } from '#services/ordering'
import { paginateByPosition } from '#services/paginate'
import { findInWs, inWs } from '#services/scoped'
import type Workspace from '#models/workspace'
import { createTodoValidator, listTodosValidator, updateTodoValidator } from '#validators/todo'

/** A recurring to-do checked off twice within this window counts once (a double-click). */
const DOUBLE_CHECK_MS = 3_000

/** A workspace's open to-dos, the list that drag-and-drop orders. */
export const openTodosOf = (ws: Workspace) => () => inWs(Todo, ws).where('done', false)

/** The advisory-lock key for a workspace's to-do order. */
export const todosList = (ws: Workspace) => `todos:${ws.id}`

/** The to-do with its goal links (`matches`, `match_level`). Goals only. */
const view = (todo: Todo) => withMatchViewOne(todo)

/**
 * Ask the AI again: clears the old result and shows the to-do as checking.
 * Returns the new (empty) goal links for the caller to save.
 */
function markPending(todo: Todo): GoalLink[] {
  todo.merge({ alignmentStatus: 'pending', alignmentReason: null, alignmentSource: null })
  return []
}

export default class TodosController {
  /** GET /todos: open to-dos in your order (done=true for completed ones). */
  async index({ request, workspace }: HttpContext) {
    const filters = await listTodosValidator.validate(request.qs())
    // Off-track to-dos left the list but weren't completed: never listed as done.
    const query = inWs(Todo, workspace)
      .where('done', filters.done ?? false)
      .where('off_track', false)
    if (filters.date) query.where('date', filters.date)
    if (filters.alignment_status) query.where('alignment_status', filters.alignment_status)

    const { rows, nextCursor } = await paginateByPosition<Todo>(query, filters, 'todos')
    return { data: await withMatchView(rows), next_cursor: nextCursor }
  }

  /**
   * POST /todos: new to-dos go on top. With the AI on, the to-do is saved as
   * "pending" and the check is queued after the commit; the save never waits.
   */
  async store({ request, response, workspace }: HttpContext) {
    const input = await request.validateUsing(createTodoValidator)
    const check = await aiActive(workspace.id)
    const todo = await inList(todosList(workspace), async (trx) =>
      Todo.create(
        {
          workspaceId: workspace.id,
          title: input.title,
          notes: input.notes ?? '',
          date: input.recurring ? null : (input.date ?? null),
          recurring: input.recurring ?? false,
          position: await topPosition(openTodosOf(workspace), trx),
          done: false,
          alignmentStatus: check ? 'pending' : null,
        },
        { client: trx }
      )
    )
    if (check) await queueTodoCheck(todo.id)
    await todo.refresh()
    return response.created(await view(todo))
  }

  async show({ params, workspace }: HttpContext) {
    const todo = await findInWs(Todo, workspace, params.id)
    return view(todo)
  }

  /**
   * PATCH /todos/:id. Completing keeps the item's position, so un-completing
   * (Undo) puts it back where it was. With the AI on, checking off a red
   * (unaligned) to-do moves it to the off-track backlog instead of
   * completing it (a recurring one stops recurring). Checking off a
   * recurring to-do logs a completion and leaves it open: the response has
   * done: false, the new completion_count and completion_id (for Undo via
   * DELETE /completions/:id). New text re-runs the AI check (even on a
   * dismissed to-do); a manual link is never touched by the AI.
   */
  async update({ params, request, workspace }: HttpContext) {
    const found = await findInWs(Todo, workspace, params.id)
    const input = await request.validateUsing(updateTodoValidator)
    const ai = await aiActive(workspace.id)

    // Everything below runs in one transaction on the locked row, so two
    // requests at once (a double-click, two tabs) can't both complete the
    // to-do, and a failure halfway leaves nothing half-written.
    const write = <T>(fn: (trx: TransactionClientContract) => Promise<T>) =>
      wantsMove(input) ? inList(todosList(workspace), fn) : db.transaction(fn)

    const result = await write(async (trx) => {
      const todo = await Todo.query({ client: trx }).where('id', found.id).forUpdate().firstOrFail()

      const willRecur = input.recurring ?? todo.recurring
      if (willRecur && input.date && input.recurring !== false) {
        throw AppError.validation('Repeating to-dos have no date.')
      }

      const textChanged =
        (input.title !== undefined && input.title !== todo.title) ||
        (input.notes !== undefined && input.notes !== todo.notes)
      if (input.title !== undefined) todo.title = input.title
      if (input.notes !== undefined) todo.notes = input.notes
      if (input.date !== undefined) todo.date = input.date

      let backlog: 'move' | 'undo' | null = null
      let completion: 'log' | 'unlog' | 'repeat' | null = null
      if (input.done === true && !todo.done) {
        if (ai && todo.alignmentStatus === 'unaligned') {
          // Checking off a red to-do moves it to the off-track backlog. It
          // leaves the list but isn't a completion, and stops recurring.
          todo.merge({ offTrack: true, done: true, doneAt: DateTime.now(), recurring: false })
          backlog = 'move'
        } else if (todo.recurring) {
          // One completion logged; the to-do stays open in its spot. A second
          // check-off within a few seconds is the same click arriving twice.
          const last = todo.lastCompletedAt
          const repeat = last && DateTime.now().diff(last).as('milliseconds') < DOUBLE_CHECK_MS
          completion = repeat ? 'repeat' : 'log'
        } else {
          todo.merge({ done: true, doneAt: DateTime.now() })
          completion = 'log'
        }
      } else if (input.done === false && todo.done) {
        if (todo.offTrack) {
          // Undo of a move: take it back out of the backlog.
          todo.offTrack = false
          backlog = 'undo'
        } else {
          completion = 'unlog'
        }
        todo.merge({ done: false, doneAt: null })
      }

      // After `done`, so an off-track Undo can restore a recurring to-do.
      if (input.recurring !== undefined) {
        todo.recurring = input.recurring
        if (input.recurring) todo.date = null
      }

      let check = false
      let goals: GoalLink[] | undefined
      if (input.matched_goal_id !== undefined) {
        ;({ check, goals } = await this.link(workspace, todo, input.matched_goal_id, ai, trx))
      } else if (textChanged && todo.alignmentSource !== 'manual' && ai) {
        goals = markPending(todo)
        check = true
      }

      if (wantsMove(input)) {
        todo.position = await positionFor(openTodosOf(workspace), input, todo.id, trx)
      }
      await todo.useTransaction(trx).save()
      if (goals) await setMatches(todo.id, goals, trx)

      if (backlog === 'move') {
        await OffTrackItem.create(
          {
            workspaceId: workspace.id,
            todoId: todo.id,
            titleSnapshot: todo.title,
            notesSnapshot: todo.notes,
            reason: todo.alignmentReason,
            status: 'open',
            movedAt: DateTime.now(),
          },
          { client: trx }
        )
      } else if (backlog === 'undo') {
        await inWs(OffTrackItem, workspace)
          .useTransaction(trx)
          .where('todo_id', todo.id)
          .where('status', 'open')
          .delete()
      }

      let completionId: number | undefined
      if (completion === 'log') {
        const logged = await logCompletion(todo, ai, trx)
        completionId = logged.id
      }
      if (completion === 'repeat') {
        const latest = await latestCompletion(todo.id, trx)
        completionId = latest?.id
      }
      if (completion === 'unlog') await removeLatestCompletion(todo.id, trx)
      if (completion === 'log' || completion === 'unlog') await todo.refresh()
      return { todo, check, completionId }
    })

    if (result.check) await queueTodoCheck(result.todo.id)
    const body = await view(result.todo)
    return result.completionId === undefined
      ? body
      : { ...body, completion_id: result.completionId }
  }

  /**
   * "Link to…": pin the to-do to an active goal by hand. null removes a
   * manual link and hands the to-do back to the AI. Returns whether a check
   * should be queued and the new goal links.
   */
  private async link(
    ws: Workspace,
    todo: Todo,
    goalId: number | null,
    ai: boolean,
    trx: TransactionClientContract
  ) {
    if (goalId === null) {
      const check = ai
      if (check) markPending(todo)
      else todo.merge({ alignmentStatus: null, alignmentReason: null, alignmentSource: null })
      return { check, goals: [] }
    }
    const goal = await inWs(Goal, ws).useTransaction(trx).where('id', goalId).first()
    if (goal?.status !== 'active') throw AppError.validation('Pick an active goal.')
    todo.merge({
      alignmentStatus: 'aligned',
      alignmentReason: null,
      alignmentSource: 'manual',
      checkedAt: DateTime.now(),
    })
    return { check: false, goals: [{ id: goalId, confidence: null }] }
  }

  /** POST /todos/:id/recheck: run the AI check again (also after an error). */
  async recheck({ params, workspace }: HttpContext) {
    const todo = await findInWs(Todo, workspace, params.id)
    if (!(await aiActive(workspace.id))) throw AppError.validation('The AI check is off.')
    if (todo.done) throw AppError.validation('Completed to-dos are not checked.')
    await setMatches(todo.id, markPending(todo))
    await todo.save()
    await queueTodoCheck(todo.id)
    await todo.refresh()
    return view(todo)
  }

  /** POST /todos/:id/dismiss: "This is fine". Not re-flagged unless the text changes. */
  async dismiss({ params, workspace }: HttpContext) {
    const todo = await findInWs(Todo, workspace, params.id)
    todo.merge({ alignmentStatus: 'dismissed', alignmentReason: null, alignmentSource: null })
    await todo.save()
    await setMatches(todo.id, [])
    return view(todo)
  }

  /** DELETE /todos/:id. Its past completions stay counted (todo_id → null). */
  async destroy({ params, response, workspace }: HttpContext) {
    const todo = await findInWs(Todo, workspace, params.id)
    await todo.delete()
    return response.noContent()
  }
}
