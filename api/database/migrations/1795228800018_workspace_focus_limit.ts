import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The goal limit moves from the user to each workspace (V2-UI-CHANGES §6).
 * Every workspace starts with its owner's current limit. users.focus_limit
 * stays until a deploy that no longer reads it can drop it.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('workspaces', (table) => {
      table.smallint('focus_limit').notNullable().defaultTo(3)
    })
    this.defer(async (db) => {
      await db.rawQuery(
        'UPDATE workspaces SET focus_limit = users.focus_limit FROM users WHERE users.id = workspaces.user_id'
      )
      await db.rawQuery(
        'ALTER TABLE workspaces ADD CONSTRAINT workspaces_focus_limit_check CHECK (focus_limit IN (3, 5, 7))'
      )
    })
  }

  async down() {
    this.schema.alterTable('workspaces', (table) => {
      table.dropColumn('focus_limit')
    })
  }
}
