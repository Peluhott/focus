import { DateTime } from 'luxon'
import { belongsTo, column, computed } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import AppBaseModel from '#models/app_base_model'
import User from '#models/user'

/** The two workspaces every account starts with; their kind doubles as a header alias. */
export const WORKSPACE_KINDS = ['personal', 'work'] as const
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number]

/** How many workspaces one user may have. */
export const MAX_WORKSPACES = 20

/**
 * A workspace: its own goals, projects, to-dos, notes and the AI's records.
 * A user has any number (always at least one), starting with Personal (AI
 * on) and Work (AI off). The AI setting is per workspace; turning it on
 * needs the warning confirmed everywhere but the original Personal.
 */
export default class Workspace extends AppBaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  /** 'personal' / 'work' for the two defaults, null for workspaces the user made. */
  @column({ serializeAs: null })
  declare kind: WorkspaceKind | null

  /** Null only on rows the old deploy made; use `displayName`. */
  @column({ serializeAs: null })
  declare name: string | null

  @column()
  declare position: string | null

  @column()
  declare aiEnabled: boolean

  @column()
  declare aiAckRequired: boolean

  /** Latest acknowledgement of the AI warning (every one is in ai_consents). */
  @column.dateTime({ serializeAs: null })
  declare workAiAckAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @computed({ serializeAs: 'name' })
  get displayName(): string {
    return this.name ?? (this.kind === 'work' ? 'Work' : 'Personal')
  }

  /** The user's workspaces in list order. */
  static ofUser(userId: number) {
    return Workspace.query()
      .where('user_id', userId)
      .orderByRaw('position COLLATE "C" ASC NULLS LAST')
      .orderBy('id')
  }
}

/** What the web app gets for each workspace. */
export function workspaceView(ws: Workspace) {
  return {
    id: ws.id,
    name: ws.displayName,
    position: ws.position,
    ai_enabled: ws.aiEnabled,
    ai_ack_required: ws.aiAckRequired,
  }
}
