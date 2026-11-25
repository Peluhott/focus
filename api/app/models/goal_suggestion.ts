import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import AppBaseModel from '#models/app_base_model'

export type SuggestionStatus = 'open' | 'accepted' | 'dismissed'

/** jsonb arrays: node-postgres would send a JS array as a Postgres array. */
const json = { prepare: (value: unknown) => JSON.stringify(value) }

/** A goal the AI built from a recurring backlog theme. Up to 3 per run. */
export default class GoalSuggestion extends AppBaseModel {
  static table = 'goal_suggestions'

  @column({ isPrimary: true })
  declare id: number

  /** The Personal or Work workspace this row belongs to (and through it, the user). */
  @column({ serializeAs: null })
  declare workspaceId: number

  @column()
  declare runId: number

  @column()
  declare title: string

  @column()
  declare details: string

  /** Proposed sub-goal titles. */
  @column(json)
  declare subGoals: string[]

  /** The off-track items it's based on (at least 3). */
  @column(json)
  declare itemIds: number[]

  @column()
  declare rationale: string

  @column()
  declare status: SuggestionStatus

  @column()
  declare acceptedGoalId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
