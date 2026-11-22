import { DateTime } from 'luxon'
import { column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import AppBaseModel from '#models/app_base_model'
import GoalSuggestion from '#models/goal_suggestion'

export type SuggestionTrigger = 'goal_completed' | 'limit_raised'
export type SuggestionRunStatus = 'queued' | 'ready' | 'empty' | 'error' | 'skipped'

/** One per goal completion or limit increase while the AI is on. */
export default class GoalSuggestionRun extends AppBaseModel {
  static table = 'goal_suggestion_runs'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare trigger: SuggestionTrigger

  @column()
  declare triggerGoalId: number | null

  @column()
  declare status: SuggestionRunStatus

  /** Open backlog items the model saw. */
  @column()
  declare itemCount: number

  @column()
  declare model: string | null

  @column()
  declare inputTokens: number

  @column()
  declare outputTokens: number

  @column({ serializeAs: null })
  declare error: string | null

  @hasMany(() => GoalSuggestion, { foreignKey: 'runId' })
  declare suggestions: HasMany<typeof GoalSuggestion>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
