import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import AppBaseModel from '#models/app_base_model'

export const OFF_TRACK_STATUSES = ['open', 'used', 'cleared'] as const
export type OffTrackStatus = (typeof OFF_TRACK_STATUSES)[number]

/**
 * One red to-do you checked off. A snapshot of its text and the AI's reason,
 * kept as a record and as material for goal suggestions.
 */
export default class OffTrackItem extends AppBaseModel {
  static table = 'off_track_items'

  @column({ isPrimary: true })
  declare id: number

  /** The to-do it came from (null once that to-do is deleted). */
  @column()
  declare todoId: number | null

  @column()
  declare titleSnapshot: string

  @column()
  declare notesSnapshot: string

  @column()
  declare reason: string | null

  /** open: feeds suggestions · used: went into an accepted goal · cleared: removed by hand */
  @column()
  declare status: OffTrackStatus

  @column.dateTime()
  declare movedAt: DateTime

  @column()
  declare usedInGoalId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
