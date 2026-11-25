import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import AppBaseModel from '#models/app_base_model'

export const ALIGNMENT_STATUSES = ['pending', 'aligned', 'unaligned', 'dismissed', 'error'] as const
export type AlignmentStatus = (typeof ALIGNMENT_STATUSES)[number]

export default class Todo extends AppBaseModel {
  @column({ isPrimary: true })
  declare id: number

  /** The Personal or Work workspace this row belongs to (and through it, the user). */
  @column({ serializeAs: null })
  declare workspaceId: number

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

  /**
   * Recurring: one item that never leaves the list. Each check-off logs a
   * completion and the checkbox resets. Recurring to-dos have no date.
   */
  @column()
  declare recurring: boolean

  /** Cached count of this to-do's todo_completions rows ("Done N×"). */
  @column()
  declare completionCount: number

  @column.dateTime()
  declare lastCompletedAt: DateTime | null

  /** Checked off while red: moved to the off-track backlog, not completed. */
  @column()
  declare offTrack: boolean

  /** AI alignment (Phase 6). Stays null while the check is off. */
  @column()
  declare alignmentStatus: AlignmentStatus | null

  @column()
  declare alignmentReason: string | null

  @column()
  declare alignmentSource: 'ai' | 'manual' | null

  @column.dateTime()
  declare checkedAt: DateTime | null

  /*
   * Goal links live in todo_matches (#services/matches). The old
   * matched_goal_id, matched_project_id and counted columns are unused.
   */

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
