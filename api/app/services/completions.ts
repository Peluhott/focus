import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import TodoCompletion from '#models/todo_completion'
import type Todo from '#models/todo'
import { activeGoalIds } from '#services/matches'

/**
 * Completions (feature spec "How completions count"): one todo_completions
 * row per check-off, normal or recurring. The to-do caches the count and
 * the latest time, so the list can show "Done 14×" and "✓ today".
 */

/** Log one check-off. `counted`: the AI check was on, so the climb counts it. */
export async function logCompletion(todo: Todo, counted: boolean) {
  const completion = await TodoCompletion.create({
    todoId: todo.id,
    titleSnapshot: todo.title,
    completedAt: DateTime.now(),
    counted,
    goalIds: await activeGoalIds(todo.id),
  })
  await recount(todo.id)
  return completion
}

/** Un-completing a normal to-do removes its latest completion. */
export async function removeLatestCompletion(todoId: number) {
  const latest = await TodoCompletion.query()
    .where('todo_id', todoId)
    .orderBy('completed_at', 'desc')
    .orderBy('id', 'desc')
    .first()
  if (latest) await latest.delete()
  await recount(todoId)
}

/** Refresh a to-do's cached completion_count and last_completed_at. */
export async function recount(todoId: number) {
  await db.rawQuery(
    `UPDATE todos SET
       completion_count = (SELECT count(*) FROM todo_completions WHERE todo_id = :id),
       last_completed_at = (SELECT max(completed_at) FROM todo_completions WHERE todo_id = :id)
     WHERE id = :id`,
    { id: todoId }
  )
}
