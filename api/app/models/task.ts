import { DateTime } from 'luxon'
import { column, afterDelete, afterSave, beforeSave } from '@adonisjs/lucid/orm'
import AppBaseModel from '#models/app_base_model'
import {
  noteContextChange,
  queueContextRecheck,
  recheckIfContextChanged,
} from '#services/alignment/triggers'

export const TASK_STATUSES = ['pending', 'complete'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export default class Task extends AppBaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectId: number

  @column()
  declare title: string

  @column()
  declare details: string

  @column()
  declare status: TaskStatus

  /** "YYYY-MM-DD" */
  @column()
  declare dueDate: string | null

  @column()
  declare position: string

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  /** What the AI check sees changed: re-check open to-dos (Phase 6). */
  @beforeSave()
  static noteAlignmentContext(row: Task) {
    noteContextChange(row, ['title', 'status', 'projectId'])
  }

  @afterSave()
  static recheckAlignment(row: Task) {
    recheckIfContextChanged(row)
  }

  @afterDelete()
  static recheckAlignmentOnDelete() {
    void queueContextRecheck()
  }
}
