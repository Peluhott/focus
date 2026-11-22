import type { HttpContext } from '@adonisjs/core/http'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { DateTime } from 'luxon'
import AppError from '#exceptions/app_error'
import Goal from '#models/goal'
import OffTrackItem from '#models/off_track_item'
import Todo from '#models/todo'
import { aiActive, queueTodoCheck } from '#services/alignment/triggers'
import { inList, positionFor, topPosition, wantsMove } from '#services/ordering'
import { paginateByPosition } from '#services/paginate'
import { createTodoValidator, listTodosValidator, updateTodoValidator } from '#validators/todo'

/** Open to-dos, the list that drag-and-drop orders. */
const openTodos = () => Todo.query().where('done', false)

/** The matched goal, for the aligned chip. To-dos link to goals only. */
function withMatches(query: ModelQueryBuilderContract<typeof Todo>) {
  return query.preload('matchedGoal', (q) => q.select('id', 'title', 'status'))
}

async function view(todo: Todo) {
  await todo.load('matchedGoal', (q) => q.select('id', 'title', 'status'))
  return todo.serialize()
}

/** Ask the AI again: clears the old result and shows the to-do as checking. */
function markPending(todo: Todo) {
  todo.merge({
    alignmentStatus: 'pending',
    alignmentReason: null,
    matchedGoalId: null,
    matchedProjectId: null,
    alignmentSource: null,
  })
}

export default class TodosController {
  /** GET /todos: open to-dos in your order (done=true for completed ones). */
  async index({ request }: HttpContext) {
    const filters = await listTodosValidator.validate(request.qs())
    // Off-track to-dos left the list but weren't completed: never listed as done.
    const query = withMatches(
      Todo.query()
        .where('done', filters.done ?? false)
        .where('off_track', false)
    )
    if (filters.date) query.where('date', filters.date)
    if (filters.alignment_status) query.where('alignment_status', filters.alignment_status)

    const { rows, nextCursor } = await paginateByPosition<Todo>(query, filters, 'todos')
    return { data: rows.map((t) => t.serialize()), next_cursor: nextCursor }
  }

  /**
   * POST /todos: new to-dos go on top. With the AI on, the to-do is saved as
   * "pending" and the check is queued after the commit; the save never waits.
   */
  async store({ request, response }: HttpContext) {
    const input = await request.validateUsing(createTodoValidator)
    const check = await aiActive()
    const todo = await inList('todos', async (trx) =>
      Todo.create(
        {
          title: input.title,
          notes: input.notes ?? '',
          date: input.date ?? null,
          position: await topPosition(openTodos, trx),
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

  async show({ params }: HttpContext) {
    const todo = await Todo.findOrFail(params.id)
    return view(todo)
  }

  /**
   * PATCH /todos/:id. Completing keeps the item's position, so un-completing
   * (Undo) puts it back where it was. With the AI on, checking off a red
   * (unaligned) to-do moves it to the off-track backlog instead of
   * completing it. New text re-runs the AI check (even on a dismissed
   * to-do); a manual link is never touched by the AI.
   */
  async update({ params, request }: HttpContext) {
    const todo = await Todo.findOrFail(params.id)
    const input = await request.validateUsing(updateTodoValidator)

    const textChanged =
      (input.title !== undefined && input.title !== todo.title) ||
      (input.notes !== undefined && input.notes !== todo.notes)
    if (input.title !== undefined) todo.title = input.title
    if (input.notes !== undefined) todo.notes = input.notes
    if (input.date !== undefined) todo.date = input.date
    let backlog: 'move' | 'undo' | null = null
    if (input.done !== undefined && input.done !== todo.done) {
      const ai = input.done ? await aiActive() : false
      if (input.done && ai && todo.alignmentStatus === 'unaligned') {
        // Checking off a red to-do moves it to the off-track backlog. It
        // leaves the list but isn't a completion.
        todo.offTrack = true
        todo.counted = false
        backlog = 'move'
      } else if (!input.done && todo.offTrack) {
        // Undo of a move: take it back out of the backlog.
        todo.offTrack = false
        backlog = 'undo'
      } else {
        // The climb only counts completions made while the AI check is on.
        todo.counted = ai
      }
      if (!input.done) todo.counted = false
      todo.done = input.done
      todo.doneAt = input.done ? DateTime.now() : null
    }

    let check = false
    if (input.matched_goal_id !== undefined) {
      check = await this.link(todo, input.matched_goal_id)
    } else if (textChanged && todo.alignmentSource !== 'manual' && (await aiActive())) {
      markPending(todo)
      check = true
    }

    if (wantsMove(input)) {
      await inList('todos', async (trx) => {
        todo.position = await positionFor(openTodos, input, todo.id, trx)
        await todo.useTransaction(trx).save()
      })
    } else {
      await todo.save()
    }
    if (backlog === 'move') {
      await OffTrackItem.create({
        todoId: todo.id,
        titleSnapshot: todo.title,
        notesSnapshot: todo.notes,
        reason: todo.alignmentReason,
        status: 'open',
        movedAt: DateTime.now(),
      })
    } else if (backlog === 'undo') {
      await OffTrackItem.query().where('todo_id', todo.id).where('status', 'open').delete()
    }
    if (check) await queueTodoCheck(todo.id)
    return view(todo)
  }

  /**
   * "Link to…": pin the to-do to an active goal by hand. null removes a
   * manual link and hands the to-do back to the AI. Returns whether a check
   * should be queued.
   */
  private async link(todo: Todo, goalId: number | null) {
    if (goalId === null) {
      const check = await aiActive()
      if (check) markPending(todo)
      else
        todo.merge({
          alignmentStatus: null,
          alignmentReason: null,
          matchedGoalId: null,
          matchedProjectId: null,
          alignmentSource: null,
        })
      return check
    }
    const goal = await Goal.find(goalId)
    if (goal?.status !== 'active') throw AppError.validation('Pick an active goal.')
    todo.merge({
      alignmentStatus: 'aligned',
      alignmentReason: null,
      matchedGoalId: goalId,
      matchedProjectId: null,
      alignmentSource: 'manual',
      checkedAt: DateTime.now(),
    })
    return false
  }

  /** POST /todos/:id/recheck: run the AI check again (also after an error). */
  async recheck({ params }: HttpContext) {
    const todo = await Todo.findOrFail(params.id)
    if (!(await aiActive())) throw AppError.validation('The AI check is off.')
    if (todo.done) throw AppError.validation('Completed to-dos are not checked.')
    markPending(todo)
    await todo.save()
    await queueTodoCheck(todo.id)
    await todo.refresh()
    return view(todo)
  }

  /** POST /todos/:id/dismiss: "This is fine". Not re-flagged unless the text changes. */
  async dismiss({ params }: HttpContext) {
    const todo = await Todo.findOrFail(params.id)
    todo.merge({
      alignmentStatus: 'dismissed',
      alignmentReason: null,
      matchedGoalId: null,
      matchedProjectId: null,
      alignmentSource: null,
    })
    await todo.save()
    return view(todo)
  }

  async destroy({ params, response }: HttpContext) {
    const todo = await Todo.findOrFail(params.id)
    await todo.delete()
    return response.noContent()
  }
}
