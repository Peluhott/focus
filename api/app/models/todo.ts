import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import AppBaseModel from '#models/app_base_model'
import Goal from '#models/goal'

export const ALIGNMENT_STATUSES = ['pending', 'aligned', 'unaligned', 'dismissed', 'error'] as const
export type AlignmentStatus = (typeof ALIGNMENT_STATUSES)[number]

export default class Todo extends AppBaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column()
  declare notes: string

  /** Optional "YYYY-MM-DD". Informational only; never affects order. */
  @column()
  declare date: string | null

  @column()
  declare position: string

  @column()
  declare done: boolean

  @column.dateTime()
  declare doneAt: DateTime | null

  /** AI alignment (Phase 6). Stays null while the check is off. */
  @column()
  declare alignmentStatus: AlignmentStatus | null

  @column()
  declare alignmentReason: string | null

  @column()
  declare matchedGoalId: number | null

  @column()
  declare matchedProjectId: number | null

  @column()
  declare alignmentSource: 'ai' | 'manual' | null

  @column.dateTime()
  declare checkedAt: DateTime | null

  /**
   * Serialized as matched_goal ({ id, title, status }) for the chip.
   * To-dos match goals only; matched_project_id is no longer set.
   */
  @belongsTo(() => Goal, { foreignKey: 'matchedGoalId', serializeAs: 'matched_goal' })
  declare matchedGoal: BelongsTo<typeof Goal>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
