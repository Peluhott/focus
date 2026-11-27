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
import TodoMatch from '#models/todo_match'
import { releaseManualLinks } from '#services/alignment/links'

const leftActive = new WeakSet<object>()

export const GOAL_STATUSES = ['active', 'completed', 'archived'] as const
export type GoalStatus = (typeof GOAL_STATUSES)[number]

export default class Goal extends AppBaseModel {
  @column({ isPrimary: true })
  declare id: number

  /** The Personal or Work workspace this row belongs to (and through it, the user). */
  @column({ serializeAs: null })
  declare workspaceId: number

  @column()
  declare title: string

  /** No longer used (always ''); kept until the column is dropped. */
  @column({ serializeAs: null })
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
    noteContextChange(row, ['title', 'status'])
    if (row.$isPersisted && 'status' in row.$dirty && row.$original.status === 'active') {
      leftActive.add(row)
    }
  }

  /**
   * A goal that's completed or archived stops counting for its to-dos'
   * colors at once (links are filtered by active goals). Manual links to it
   * go back to the AI, which the batched re-check below then runs.
   */
  @afterSave()
  static async recheckAlignment(row: Goal) {
    if (leftActive.delete(row)) await releaseManualLinks(row.id, row.workspaceId)
    recheckIfContextChanged(row, row.workspaceId)
  }

  @afterDelete()
  static async recheckAlignmentOnDelete(row: Goal) {
    await releaseManualLinks(row.id, row.workspaceId)
    await TodoMatch.query().where('target_type', 'goal').where('target_id', row.id).delete()
    void queueContextRecheck(row.workspaceId)
  }
}
