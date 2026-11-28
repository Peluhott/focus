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

  /** No longer used (always ''); kept until the column is dropped. */
  @column({ serializeAs: null })
  declare details: string

  @column()
  declare done: boolean

  @column()
  declare position: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  /**
   * Re-check open to-dos when a sub-goal is added, moved to another goal or
   * removed. A renamed sub-goal doesn't re-grade everything.
   */
  @beforeSave()
  static noteAlignmentContext(row: SubGoal) {
    noteContextChange(row, !row.$isPersisted || 'goalId' in row.$dirty)
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
