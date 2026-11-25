import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import AppBaseModel from '#models/app_base_model'
import User from '#models/user'

export const WORKSPACE_KINDS = ['personal', 'work'] as const
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number]

/**
 * Personal or Work (designhandoff WORK-MODE.md). Every user has one of
 * each; goals, projects, to-dos, notes and the AI's records belong to one.
 * The AI setting is per workspace and off by default in Work.
 */
export default class Workspace extends AppBaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare kind: WorkspaceKind

  @column()
  declare aiEnabled: boolean

  /** Latest acknowledgement of the Work AI warning (every one is in ai_consents). */
  @column.dateTime()
  declare workAiAckAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
