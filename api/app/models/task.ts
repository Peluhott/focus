import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import AppBaseModel from '#models/app_base_model'

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

  // No AI re-check hooks: tasks aren't part of what the alignment check
  // sends (only goal and project titles are), so editing or ticking one
  // off costs nothing.
}
