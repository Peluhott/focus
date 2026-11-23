import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import AppError from '#exceptions/app_error'
import User from '#models/user'
import { createApiKeyValidator } from '#validators/api_key'

type KeyRow = {
  id: number
  name: string
  prefix: string | null
  abilities: string
  last_used_at: Date | null
  expires_at: Date | null
  revoked_at: Date | null
  created_at: Date
}

const iso = (d: Date | null) => (d ? DateTime.fromJSDate(d).toISO() : null)

function view(row: KeyRow) {
  let scopes: string[] = []
  try {
    scopes = JSON.parse(row.abilities)
  } catch {}
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes,
    last_used_at: iso(row.last_used_at),
    expires_at: row.revoked_at ? null : iso(row.expires_at),
    revoked_at: iso(row.revoked_at),
    created_at: iso(row.created_at),
  }
}

const keysOf = (userId: number) =>
  db
    .from('api_keys')
    .where('tokenable_id', userId)
    .where('type', 'api_key')
    .select(
      'id',
      'name',
      'prefix',
      'abilities',
      'last_used_at',
      'expires_at',
      'revoked_at',
      'created_at'
    )

/**
 * API keys (spec "REST API and API keys"). Session only: a key can't see or
 * make keys. The full key is returned once, at creation; only its hash and a
 * short prefix are stored.
 */
export default class ApiKeysController {
  /** GET /keys: newest first, revoked ones included. */
  async index({ auth }: HttpContext) {
    const rows: KeyRow[] = await keysOf(auth.getUserOrFail().id).orderBy('id', 'desc')
    return { data: rows.map(view) }
  }

  /** POST /keys { name, scopes, expires_on? } */
  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as User
    const input = await request.validateUsing(createApiKeyValidator)

    let expiresIn: number | undefined
    if (input.expires_on) {
      const end = DateTime.fromISO(input.expires_on, { zone: 'utc' }).endOf('day')
      if (!end.isValid) throw AppError.validation('Invalid expiry date.')
      expiresIn = Math.floor(end.diffNow('seconds').seconds)
      if (expiresIn <= 0) throw AppError.validation('The expiry date has to be in the future.')
    }

    const token = await User.accessTokens.create(user, input.scopes, {
      name: input.name,
      expiresIn,
    })
    const key = token.value!.release()
    await db
      .from('api_keys')
      .where('id', Number(token.identifier))
      .update({ prefix: key.slice(0, 12) })

    const row: KeyRow = await keysOf(user.id).where('id', Number(token.identifier)).firstOrFail()
    return response.created({ ...view(row), key })
  }

  /**
   * DELETE /keys/:id: revoke. The key also expires now, which the token
   * guard checks, so it stops working at once and stays in the list.
   */
  async destroy({ auth, params, response }: HttpContext) {
    const now = new Date()
    const updated = await db
      .from('api_keys')
      .where('id', params.id)
      .where('tokenable_id', auth.getUserOrFail().id)
      .where('type', 'api_key')
      .whereNull('revoked_at')
      .update({ revoked_at: now, expires_at: now, updated_at: now })
    const count = Array.isArray(updated) ? updated.length : Number(updated)
    if (!count) {
      const exists = await keysOf(auth.getUserOrFail().id).where('id', params.id).first()
      if (!exists) throw AppError.notFound('API key')
    }
    return response.noContent()
  }
}
