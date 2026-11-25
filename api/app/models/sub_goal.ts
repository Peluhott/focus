import { DateTime } from 'luxon'
import { column, afterDelete, afterSave, beforeSave } from '@adonisjs/lucid/orm'
import AppBaseModel from '#models/app_base_model'
import {
  noteContextChange,
  queueContextRecheck,
  recheckIfContextChanged,
  workspaceOf,
} from '#services/alignment/triggers'

export default class SubGoal extends AppBaseModel {
  static table = 'sub_goals'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare goalId: number

  @column()
  declare title: string

  @column()
  declare details: string

  @column()
  declare done: boolean

  @column()
  declare position: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  /** What the AI check sees changed: re-check open to-dos (Phase 6). */
  @beforeSave()
  static noteAlignmentContext(row: SubGoal) {
    noteContextChange(row, ['title', 'goalId'])
  }

  @afterSave()
  static recheckAlignment(row: SubGoal) {
    recheckIfContextChanged(row, () => workspaceOf('goals', row.goalId))
  }

  @afterDelete()
  static async recheckAlignmentOnDelete(row: SubGoal) {
    void queueContextRecheck(await workspaceOf('goals', row.goalId))
  }
}
