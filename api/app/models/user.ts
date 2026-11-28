import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import AppBaseModel from '#models/app_base_model'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import Workspace from '#models/workspace'
import { legacyEmail } from '#validators/auth'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export const FOCUS_LIMITS = [3, 5, 7] as const
export type FocusLimit = (typeof FOCUS_LIMITS)[number]

export default class User extends compose(AppBaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare displayName: string | null

  /** Old account-wide goal limit; each workspace has its own now (workspaces.focus_limit). */
  @column({ serializeAs: null })
  declare focusLimit: FocusLimit

  /** Default length of the nav-bar focus timer (the countdown runs in the browser). */
  @column()
  declare timerMinutes: number

  /** Workspace the web app opens in next time (null: the first one). */
  @column()
  declare lastWorkspaceId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => Workspace)
  declare workspaces: HasMany<typeof Workspace>

  /**
   * Login lookup (used by verifyCredentials, which keeps its constant-time
   * check when nothing matches). Case-insensitive, and it also tries the
   * form older sign-ups stored (Gmail dots and +tags removed), so those
   * accounts still log in with what the person types. An exact match wins.
   */
  static async findForAuth<T extends NormalizeConstructor<typeof BaseModel>>(
    this: T,
    _uids: string[],
    value: string
  ): Promise<InstanceType<T> | null> {
    const email = value.trim().toLowerCase()
    const legacy = await legacyEmail(email)
    const candidates = [...new Set([email, legacy].filter((e): e is string => !!e))]
    const row = await this.query()
      .whereRaw(`lower(email) IN (${candidates.map(() => '?').join(', ')})`, candidates)
      .orderByRaw('lower(email) = ? DESC', [email])
      .first()
    return (row as InstanceType<T> | null) ?? null
  }

  /** API keys ("fk_…"), stored hashed in api_keys; abilities are the scopes. */
  static accessTokens = DbAccessTokensProvider.forModel(User, {
    table: 'api_keys',
    type: 'api_key',
    prefix: 'fk_',
  })
}
