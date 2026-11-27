import { BaseSchema } from '@adonisjs/lucid/schema'
import { generateKeyBetween } from 'fractional-indexing'

/**
 * Any number of workspaces per user (named, ordered, deletable; at least
 * one), plus the feedback form (designhandoff FEEDBACK.md).
 *
 * Additive only: the deployed app shares this database and still looks
 * workspaces up by `kind` ('personal' / 'work'). So `kind` stays (nullable
 * now: new workspaces have none) and `name` stays nullable until a cleanup
 * migration after deploy (name NOT NULL, drop users.last_workspace).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('workspaces', (table) => {
      table.string('name', 60).nullable()
      table.specificType('position', 'text COLLATE "C"').nullable()
      /** Turning AI on needs the warning confirmed (every workspace but the original Personal). */
      table.boolean('ai_ack_required').notNullable().defaultTo(true)
      table.setNullable('kind')
      table.index(['user_id', 'position'])
    })

    this.schema.alterTable('users', (table) => {
      table
        .integer('last_workspace_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('workspaces')
        .onDelete('SET NULL')
    })

    /** Consents outlive their workspace (legal record): keep the row, note the name. */
    this.schema.alterTable('ai_consents', (table) => {
      table.dropForeign(['workspace_id'])
    })
    this.schema.alterTable('ai_consents', (table) => {
      table.setNullable('workspace_id')
      table.foreign('workspace_id').references('id').inTable('workspaces').onDelete('SET NULL')
      table.string('workspace_name', 60).nullable()
    })

    /** AI spend of deleted workspaces, so deleting one doesn't reset the caps. */
    this.schema.createTable('ai_spend_carryovers', (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('model', 100).nullable()
      table.bigInteger('input_tokens').notNullable().defaultTo(0)
      table.bigInteger('output_tokens').notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['created_at'])
    })

    this.schema.createTable('feedback', (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .integer('workspace_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('workspaces')
        .onDelete('SET NULL')
      table
        .enu('type', ['idea', 'bug', 'other'], { useNative: false, enumName: 'feedback_type' })
        .notNullable()
      table.string('feature', 40).notNullable()
      table.text('message').notNullable()
      table.boolean('contact_ok').notNullable().defaultTo(true)
      table.string('email', 254).nullable()
      table.text('screenshot_public_id').nullable()
      table.text('page').nullable()
      table.string('workspace_name', 60).nullable()
      table.string('app_version', 40).nullable()
      table.text('user_agent').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(`UPDATE workspaces SET name = 'Personal' WHERE name IS NULL AND kind = 'personal'`)
      await db.rawQuery(`UPDATE workspaces SET name = 'Work' WHERE name IS NULL AND kind = 'work'`)
      await db.rawQuery(`UPDATE workspaces SET ai_ack_required = false WHERE kind = 'personal'`)
      const first = generateKeyBetween(null, null)
      const second = generateKeyBetween(first, null)
      await db.rawQuery(
        `UPDATE workspaces SET position = CASE WHEN kind = 'personal' THEN ? ELSE ? END
         WHERE position IS NULL`,
        [first, second]
      )
      await db.rawQuery(`
        UPDATE users u SET last_workspace_id = w.id
        FROM workspaces w
        WHERE w.user_id = u.id AND w.kind = u.last_workspace AND u.last_workspace_id IS NULL`)
      await db.rawQuery(`
        UPDATE ai_consents c SET workspace_name = w.name
        FROM workspaces w WHERE w.id = c.workspace_id AND c.workspace_name IS NULL`)
    })
  }

  async down() {
    this.schema.dropTable('feedback')
    this.schema.dropTable('ai_spend_carryovers')
    this.schema.alterTable('ai_consents', (table) => {
      table.dropForeign(['workspace_id'])
      table.dropColumn('workspace_name')
    })
    this.schema.alterTable('ai_consents', (table) => {
      table.foreign('workspace_id').references('id').inTable('workspaces').onDelete('CASCADE')
    })
    this.schema.alterTable('users', (table) => table.dropColumn('last_workspace_id'))
    this.schema.alterTable('workspaces', (table) => {
      table.dropIndex(['user_id', 'position'])
      table.dropColumn('name')
      table.dropColumn('position')
      table.dropColumn('ai_ack_required')
    })
  }
}
