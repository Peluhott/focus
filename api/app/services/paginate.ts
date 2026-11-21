import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import AppError from '#exceptions/app_error'

export const MAX_LIMIT = 100

/**
 * Cursor pagination over a list ordered by (position, id). The cursor is an
 * opaque string: base64url of the last row's position and id.
 */
export async function paginateByPosition<T extends { id: number; position: string }>(
  query: ModelQueryBuilderContract<LucidModel, any>,
  { cursor, limit }: { cursor?: string | null; limit?: number | null },
  table: string
): Promise<{ rows: T[]; nextCursor: string | null }> {
  const take = Math.min(Math.max(limit ?? MAX_LIMIT, 1), MAX_LIMIT)
  if (cursor) {
    const after = decodeCursor(cursor)
    query.whereRaw(`(${table}.position, ${table}.id) > (? COLLATE "C", ?)`, [
      after.position,
      after.id,
    ])
  }
  const rows = (await query
    .orderBy(`${table}.position`, 'asc')
    .orderBy(`${table}.id`, 'asc')
    .limit(take + 1)) as unknown as T[]

  const hasMore = rows.length > take
  const page = hasMore ? rows.slice(0, take) : rows
  const last = page.at(-1)
  return {
    rows: page,
    nextCursor: hasMore && last ? encodeCursor(last.position, last.id) : null,
  }
}

function encodeCursor(position: string, id: number): string {
  return Buffer.from(JSON.stringify([position, id])).toString('base64url')
}

function decodeCursor(cursor: string): { position: string; id: number } {
  try {
    const [position, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString())
    if (typeof position === 'string' && Number.isInteger(id)) return { position, id }
  } catch {}
  throw AppError.validation('Invalid cursor.')
}
