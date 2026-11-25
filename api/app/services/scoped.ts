import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import SubGoal from '#models/sub_goal'
import Task from '#models/task'
import ProjectFile from '#models/project_file'
import TodoCompletion from '#models/todo_completion'
import type Workspace from '#models/workspace'

/**
 * Every read and write of user data goes through a workspace (which belongs
 * to one user), so other users' rows and the other workspace's rows are
 * invisible: a lookup across them is a plain 404.
 */
type Ws = Pick<Workspace, 'id'>

/** `Model.query()` limited to one workspace. */
export function inWs<T extends LucidModel>(
  model: T,
  ws: Ws,
  trx?: TransactionClientContract
): ModelQueryBuilderContract<T, InstanceType<T>> {
  return model.query({ client: trx }).where(`${model.table}.workspace_id`, ws.id)
}

/** `Model.findOrFail(id)` within one workspace (404 otherwise). */
export function findInWs<T extends LucidModel>(
  model: T,
  ws: Ws,
  id: number,
  trx?: TransactionClientContract
): Promise<InstanceType<T>> {
  return inWs(model, ws, trx).where(`${model.table}.id`, id).firstOrFail()
}

/** Children reach their workspace through the parent row. */
export function findSubGoal(ws: Ws, id: number) {
  return SubGoal.query()
    .where('id', id)
    .whereIn('goal_id', (q) => q.from('goals').where('workspace_id', ws.id).select('id'))
    .firstOrFail()
}

export function findTask(ws: Ws, id: number) {
  return Task.query()
    .where('id', id)
    .whereIn('project_id', (q) => q.from('projects').where('workspace_id', ws.id).select('id'))
    .firstOrFail()
}

export function findFile(ws: Ws, id: number) {
  return ProjectFile.query()
    .where('id', id)
    .whereIn('project_id', (q) => q.from('projects').where('workspace_id', ws.id).select('id'))
    .firstOrFail()
}

export function findCompletion(ws: Ws, id: number) {
  return findInWs(TodoCompletion, ws, id)
}
