import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import AppBaseModel from '#models/app_base_model'

/** A file on a project. Metadata only; the file lives in Cloudinary. */
export default class ProjectFile extends AppBaseModel {
  static table = 'project_files'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare projectId: number

  @column()
  declare name: string

  @column({ serializeAs: null })
  declare cloudinaryPublicId: string

  /** image, video or raw (Cloudinary's resource types). */
  @column()
  declare resourceType: string

  @column()
  declare format: string | null

  @column({ consume: (v) => Number(v) })
  declare bytes: number

  @column.dateTime()
  declare uploadedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
