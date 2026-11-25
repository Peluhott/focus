import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { aiActive } from './triggers.js'

/**
 * A goal left the active list (completed, archived or deleted). Open to-dos
 * linked to it *by hand* have no other way to be re-checked, so hand them
 * back to the AI: they may match another goal, or turn red. AI-linked to-dos
 * are re-checked by the batched context re-check anyway.
 */
export async function releaseManualLinks(goalId: number, workspaceId: number) {
  try {
    const ids = await db
      .from('todos')
      .join('todo_matches', 'todo_matches.todo_id', 'todos.id')
      .where('todo_matches.target_type', 'goal')
      .where('todo_matches.target_id', goalId)
      .where('todos.alignment_source', 'manual')
      .where('todos.done', false)
      .select('todos.id')
    if (ids.length === 0) return
    const ai = await aiActive(workspaceId)
    await db
      .from('todos')
      .whereIn(
        'id',
        ids.map((r: { id: number }) => r.id)
      )
      .update({
        alignment_status: ai ? 'pending' : null,
        alignment_reason: null,
        alignment_source: null,
      })
  } catch (error) {
    logger.error({ err: error, goalId }, 'could not release manual links')
  }
}
