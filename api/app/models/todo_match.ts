import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import AppBaseModel from '#models/app_base_model'

/**
 * A link between a to-do and a goal it serves (feature spec "Multi-goal
 * matching"). To-dos link to goals only (handoff README, "Changes from the
 * spec" §2), so target_type is always "goal" for now.
 */
export default class TodoMatch extends AppBaseModel {
  static table = 'todo_matches'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare todoId: number

  @column()
  declare targetType: 'goal' | 'project'

  @column()
  declare targetId: number

  /** Model confidence; null for manual links and backfilled rows. */
  @column()
  declare confidence: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
