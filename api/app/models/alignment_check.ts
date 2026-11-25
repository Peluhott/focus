import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import AppBaseModel from '#models/app_base_model'
import type { Verdict } from '#services/alignment/types'

/** One row per model call: cost tracking, the spend cap, the cache and evals. */
export default class AlignmentCheck extends AppBaseModel {
  @column({ isPrimary: true })
  declare id: number

  /** The Personal or Work workspace this row belongs to (and through it, the user). */
  @column({ serializeAs: null })
  declare workspaceId: number

  @column()
  declare todoId: number | null

  @column()
  declare model: string

  @column()
  declare contextVersion: string

  @column()
  declare inputHash: string | null

  /** The validated verdict, or null when the call failed. */
  @column()
  declare verdict: Verdict | null

  @column()
  declare inputTokens: number

  @column()
  declare outputTokens: number

  @column()
  declare latencyMs: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
