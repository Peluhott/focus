import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import aiConfig from '#config/ai'
import { alignmentQueue } from './queue.js'

/**
 * Where the rest of the app touches the AI check. Every function here is
 * safe to call from a request: failures are logged, never thrown, so saves
 * work the same whether the AI is on, off or broken.
 *
 * The AI setting is per workspace (Personal / Work). Nothing from a
 * workspace is sent to the model unless that workspace's ai_enabled is on.
 */

let forced: boolean | undefined

/** AI_ENABLED and a key on the server. Tests can force it. */
export function aiConfigured() {
  return forced ?? (aiConfig.enabled && !!aiConfig.apiKey)
}

export function forceAiConfigured(value: boolean | undefined) {
  forced = value
}

/** Configured on the server *and* switched on for this workspace. */
export async function aiActive(workspaceId: number | null | undefined) {
  if (!aiConfigured() || !workspaceId) return false
  const row = await db.from('workspaces').where('id', workspaceId).select('ai_enabled').first()
  return !!row?.ai_enabled
}

/** Queue a check for one to-do (already saved as "pending"). */
export async function queueTodoCheck(todoId: number) {
  try {
    await alignmentQueue().checkTodo(todoId)
    return true
  } catch (error) {
    logger.error({ err: error, todoId }, 'could not queue an alignment check')
    await db
      .from('todos')
      .where('id', todoId)
      .where('alignment_status', 'pending')
      .update({ alignment_status: 'error', alignment_reason: "Couldn't start the AI check." })
      .catch(() => {})
    return false
  }
}

/** A workspace's goals or projects changed: re-check its open to-dos (batched by the queue). */
export async function queueContextRecheck(workspaceId: number | null | undefined) {
  try {
    if (workspaceId && (await aiActive(workspaceId))) {
      await alignmentQueue().checkAll(workspaceId)
    }
  } catch (error) {
    logger.error({ err: error, workspaceId }, 'could not queue an alignment re-check')
  }
}

/** The workspace of a goal or project, for child rows (sub-goals, tasks). */
export async function workspaceOf(table: 'goals' | 'projects', id: number) {
  const row = await db.from(table).where('id', id).select('workspace_id').first()
  return (row?.workspace_id as number | null | undefined) ?? null
}

/**
 * Model hooks: remember in beforeSave whether a field the model sees
 * changed (Lucid clears $dirty before afterSave), then queue in afterSave.
 */
const touched = new WeakSet<object>()

export function noteContextChange(
  model: { $isPersisted: boolean; $dirty: Record<string, unknown> },
  fields: string[]
) {
  if (!model.$isPersisted || fields.some((f) => f in model.$dirty)) touched.add(model)
}

/** `workspace` is the id, or a lookup for rows that only know their parent. */
export function recheckIfContextChanged(
  model: object,
  workspace: number | null | (() => Promise<number | null>)
) {
  if (!touched.delete(model)) return
  // Fire and forget: the request doesn't wait, and errors are logged.
  void (async () => {
    const id = typeof workspace === 'function' ? await workspace() : workspace
    await queueContextRecheck(id)
  })().catch((error) => logger.error({ err: error }, 'could not queue an alignment re-check'))
}
