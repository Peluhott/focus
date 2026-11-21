import { generateKeyBetween } from 'fractional-indexing'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import AppError from '#exceptions/app_error'

/**
 * Manual ordering with fractional indexing: every list item has a `position`
 * string key, and moving an item writes only that item's row.
 *
 * `siblings` builds a fresh query for the list the item lives in (open
 * to-dos, active goals, one goal's sub-goals, ...). Position columns use the
 * "C" collation, so SQL comparisons match the keys' byte order.
 */
type Siblings = () => ModelQueryBuilderContract<LucidModel, any>
type Trx = TransactionClientContract

export type Placement = { before_id?: number | null; after_id?: number | null }

/**
 * Run `fn` in a transaction holding a lock on one list (e.g. "todos",
 * "subgoals:12"). Every write that picks a position goes through here, so
 * two requests can't read the same neighbours and get the same key. The lock
 * is transaction-scoped, which works through Neon's pooler.
 */
export function inList<T>(list: string, fn: (trx: Trx) => Promise<T>): Promise<T> {
  return db.transaction(async (trx) => {
    await trx.rawQuery('SELECT pg_advisory_xact_lock(hashtext(?))', [list])
    return fn(trx)
  })
}

async function edge(siblings: Siblings, trx: Trx, dir: 'asc' | 'desc'): Promise<string | null> {
  const row = await siblings()
    .useTransaction(trx)
    .orderBy('position', dir)
    .orderBy('id', dir)
    .first()
  return row ? (row as any).position : null
}

/** Key for a new item at the top of the list. Call inside inList(). */
export async function topPosition(siblings: Siblings, trx: Trx): Promise<string> {
  return generateKeyBetween(null, await edge(siblings, trx, 'asc'))
}

/** Key for a new item at the bottom of the list. Call inside inList(). */
export async function bottomPosition(siblings: Siblings, trx: Trx): Promise<string> {
  return generateKeyBetween(await edge(siblings, trx, 'desc'), null)
}

/**
 * Key for moving item `selfId` directly above `before_id` or directly below
 * `after_id`. The server works out the neighbours, so clients only name one.
 */
export async function positionFor(
  siblings: Siblings,
  placement: Placement,
  selfId: number,
  trx: Trx
): Promise<string> {
  const { before_id: beforeId, after_id: afterId } = placement
  if ((beforeId == null) === (afterId == null)) {
    throw AppError.validation('Give exactly one of before_id or after_id.')
  }
  const targetId = (beforeId ?? afterId)!
  if (targetId === selfId) {
    throw AppError.validation("An item can't be placed next to itself.")
  }
  const target = (await siblings().useTransaction(trx).where('id', targetId).first()) as any
  if (!target) {
    throw AppError.validation(`Item ${targetId} isn't in this list.`)
  }

  if (beforeId != null) {
    const prev = (await siblings()
      .useTransaction(trx)
      .whereNot('id', selfId)
      .where('position', '<', target.position)
      .orderBy('position', 'desc')
      .first()) as any
    return generateKeyBetween(prev?.position ?? null, target.position)
  }
  const next = (await siblings()
    .useTransaction(trx)
    .whereNot('id', selfId)
    .where('position', '>', target.position)
    .orderBy('position', 'asc')
    .first()) as any
  return generateKeyBetween(target.position, next?.position ?? null)
}

/** True when the request body asks for a move. */
export function wantsMove(placement: Placement): boolean {
  return placement.before_id != null || placement.after_id != null
}
