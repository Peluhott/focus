import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { column } from '@adonisjs/lucid/orm'
import AppBaseModel from '#models/app_base_model'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'

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
  declare focusLimit: FocusLimit

  @column()
  declare aiEnabled: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  /** API keys ("fk_…"), stored hashed in api_keys; abilities are the scopes. */
  static accessTokens = DbAccessTokensProvider.forModel(User, {
    table: 'api_keys',
    type: 'api_key',
    prefix: 'fk_',
  })
}
