import { DateTime } from 'luxon'
import { belongsTo, column, hasMany, afterDelete, afterSave, beforeSave } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import AppBaseModel from '#models/app_base_model'
import {
  noteContextChange,
  queueContextRecheck,
  recheckIfContextChanged,
} from '#services/alignment/triggers'
import Goal from '#models/goal'
import Task from '#models/task'
import ProjectFile from '#models/project_file'

export const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'done', 'archived'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export default class Project extends AppBaseModel {
  @column({ isPrimary: true })
  declare id: number

  /** The Personal or Work workspace this row belongs to (and through it, the user). */
  @column({ serializeAs: null })
  declare workspaceId: number

  @column()
  declare title: string

  @column()
  declare details: string

  @column()
  declare status: ProjectStatus

  @column()
  declare goalId: number | null

  /** "YYYY-MM-DD" (DATE columns are parsed as strings). */
  @column()
  declare dueDate: string | null

  @column()
  declare position: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Goal)
  declare goal: BelongsTo<typeof Goal>

  @hasMany(() => Task)
  declare tasks: HasMany<typeof Task>

  @hasMany(() => ProjectFile)
  declare files: HasMany<typeof ProjectFile>

  /** What the AI check sees changed: re-check open to-dos (Phase 6). */
  @beforeSave()
  static noteAlignmentContext(row: Project) {
    noteContextChange(row, ['title', 'details', 'status', 'goalId'])
  }

  @afterSave()
  static recheckAlignment(row: Project) {
    recheckIfContextChanged(row, row.workspaceId)
  }

  @afterDelete()
  static recheckAlignmentOnDelete(row: Project) {
    void queueContextRecheck(row.workspaceId)
  }
}
