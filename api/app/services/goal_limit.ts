import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AppError from '#exceptions/app_error'
import Goal from '#models/goal'
import User from '#models/user'
import Workspace from '#models/workspace'

/**
 * The focus limit: only `active` goals count, and a workspace can't have
 * more of them than users.focus_limit (3, 5 or 7). The limit is the user's,
 * applied to Personal and Work separately.
 */
export async function activeGoalCount(
  workspaceId: number,
  trx?: TransactionClientContract
): Promise<number> {
  const row = await Goal.query({ client: trx })
    .where('workspace_id', workspaceId)
    .where('status', 'active')
    .count('* as total')
    .first()
  return Number(row?.$extras.total ?? 0)
}

/**
 * Throws 409 goal_limit_reached if one more active goal would go over the
 * limit. Locks the workspace row so two concurrent creates can't both slip in.
 */
export async function assertCanActivate(workspaceId: number, trx: TransactionClientContract) {
  const workspace = await Workspace.query({ client: trx })
    .where('id', workspaceId)
    .forUpdate()
    .firstOrFail()
  const user = await User.query({ client: trx }).where('id', workspace.userId).firstOrFail()
  if ((await activeGoalCount(workspaceId, trx)) >= user.focusLimit) {
    throw AppError.goalLimitReached()
  }
}
