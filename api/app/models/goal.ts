import { DateTime } from 'luxon'
import { column, hasMany, afterDelete, afterSave, beforeSave } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import AppBaseModel from '#models/app_base_model'
import {
  noteContextChange,
  queueContextRecheck,
  recheckIfContextChanged,
} from '#services/alignment/triggers'
import SubGoal from '#models/sub_goal'
import Project from '#models/project'

export const GOAL_STATUSES = ['active', 'completed', 'archived'] as const
export type GoalStatus = (typeof GOAL_STATUSES)[number]

export default class Goal extends AppBaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column()
  declare details: string

  @column()
  declare status: GoalStatus

  @column()
  declare position: string

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => SubGoal)
  declare subGoals: HasMany<typeof SubGoal>

  @hasMany(() => Project)
  declare projects: HasMany<typeof Project>

  /** What the AI check sees changed: re-check open to-dos (Phase 6). */
  @beforeSave()
  static noteAlignmentContext(row: Goal) {
    noteContextChange(row, ['title', 'details', 'status'])
  }

  @afterSave()
  static recheckAlignment(row: Goal) {
    recheckIfContextChanged(row)
  }

  @afterDelete()
  static recheckAlignmentOnDelete() {
    void queueContextRecheck()
  }
}
