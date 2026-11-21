import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AppError from '#exceptions/app_error'
import Goal from '#models/goal'
import User from '#models/user'

/**
 * The focus limit: only `active` goals count, and you can't have more of
 * them than users.focus_limit (3, 5 or 7).
 */
export async function activeGoalCount(trx?: TransactionClientContract): Promise<number> {
  const row = await Goal.query({ client: trx })
    .where('status', 'active')
    .count('* as total')
    .first()
  return Number(row?.$extras.total ?? 0)
}

/**
 * Throws 409 goal_limit_reached if one more active goal would go over the
 * limit. Locks the user row so two concurrent creates can't both slip in.
 */
export async function assertCanActivate(userId: number, trx: TransactionClientContract) {
  const user = await User.query({ client: trx }).where('id', userId).forUpdate().firstOrFail()
  if ((await activeGoalCount(trx)) >= user.focusLimit) {
    throw AppError.goalLimitReached()
  }
}
