import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import AppBaseModel from '#models/app_base_model'

/**
 * One check-off, normal or recurring. Kept when the to-do is deleted, so
 * past completions stay counted.
 */
export default class TodoCompletion extends AppBaseModel {
  static table = 'todo_completions'

  @column({ isPrimary: true })
  declare id: number

  /** The Personal or Work workspace this row belongs to (and through it, the user). */
  @column({ serializeAs: null })
  declare workspaceId: number

  @column()
  declare todoId: number | null

  @column()
  declare titleSnapshot: string

  @column.dateTime()
  declare completedAt: DateTime

  /** Counts toward the climb: logged while the AI check was on. */
  @column()
  declare counted: boolean

  /** The active goals the to-do matched when it was checked off. */
  @column()
  declare goalIds: number[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
