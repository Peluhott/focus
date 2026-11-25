import logger from '@adonisjs/core/services/logger'
import type Todo from '#models/todo'
import TodoHintRun from '#models/todo_hint_run'
import { alignmentQueue } from '#services/alignment/queue'
import { hintHash, hintInput } from './input.js'

/**
 * Ask for a hint on a to-do. Without `force`, an unchanged to-do reuses its
 * last ready (or still queued) run, so the model isn't called again. Never
 * throws: a queue failure ends the run as "error". `reused` says no new
 * job was queued.
 */
export async function startHintRun(
  todo: Todo,
  { force = false }: { force?: boolean } = {}
): Promise<{ run: TodoHintRun; reused: boolean }> {
  const inputHash = hintHash(await hintInput(todo))
  if (!force) {
    const latest = await TodoHintRun.query()
      .where('todo_id', todo.id)
      .where('input_hash', inputHash)
      .whereIn('status', ['ready', 'queued'])
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .first()
    if (latest) return { run: latest, reused: true }
  }

  const run = await TodoHintRun.create({
    todoId: todo.id,
    workspaceId: todo.workspaceId,
    status: 'queued',
    inputHash,
  })
  try {
    await alignmentQueue().hintTodo(run.id)
  } catch (error) {
    logger.error({ err: error, todoId: todo.id }, 'could not queue to-do hint')
    run.merge({ status: 'error', error: "Couldn't think of a first step. Try again." })
    await run.save().catch(() => {})
  }
  return { run, reused: false }
}
