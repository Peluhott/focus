import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import AppBaseModel from '#models/app_base_model'

export type HintRunStatus = 'queued' | 'ready' | 'error' | 'skipped'

/**
 * One AI "Help me start" request for a to-do (designhandoff START-SMALL.md):
 * one small first step to do today. Tokens count toward the shared AI
 * budget. Statuses: queued (poll again), ready, error (`error` says why),
 * skipped (the to-do is gone).
 */
export default class TodoHintRun extends AppBaseModel {
  static table = 'todo_hint_runs'

  @column({ isPrimary: true })
  declare id: number

  /** The Personal or Work workspace this row belongs to (and through it, the user). */
  @column({ serializeAs: null })
  declare workspaceId: number

  @column()
  declare todoId: number

  @column()
  declare status: HintRunStatus

  /** What the model saw (title, notes, goals); an unchanged to-do reuses the run. */
  @column({ serializeAs: null })
  declare inputHash: string

  /** The first step, as an instruction. Stored in `hint`, sent as `text`. */
  @column({ columnName: 'hint', serializeAs: 'text' })
  declare text: string

  @column()
  declare model: string | null

  @column({ serializeAs: null })
  declare inputTokens: number

  @column({ serializeAs: null })
  declare outputTokens: number

  @column()
  declare error: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
