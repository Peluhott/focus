import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * - ai_usage: one row per model attempt, the only source of the spend caps.
 *   Rows outlive the to-do, run and workspace they came from, so deleting
 *   anything can't reset the caps. Backfilled with this month's spend.
 * - Unique lower(email): one account per address, whatever the case.
 * - Unique project_files.cloudinary_public_id: one record per uploaded file.
 * Additive only: the deployed app shares this database.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('ai_usage', (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('workspace_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('workspaces')
        .onDelete('SET NULL')
      table.string('kind', 20).notNullable()
      table.string('model', 100).nullable()
      table.integer('input_tokens').notNullable().defaultTo(0)
      table.integer('output_tokens').notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['created_at'])
      table.index(['user_id', 'created_at'])
    })

    this.defer(async (db) => {
      const monthStart = `date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`
      const sources = [
        ['alignment_checks', 'alignment'],
        ['goal_suggestion_runs', 'suggestion'],
        ['todo_hint_runs', 'hint'],
      ] as const
      for (const [table, kind] of sources) {
        await db.rawQuery(
          `INSERT INTO ai_usage (user_id, workspace_id, kind, model, input_tokens, output_tokens, created_at)
           SELECT w.user_id, t.workspace_id, ?, t.model,
                  COALESCE(SUM(t.input_tokens), 0), COALESCE(SUM(t.output_tokens), 0), NOW()
           FROM ${table} t JOIN workspaces w ON w.id = t.workspace_id
           WHERE t.created_at >= ${monthStart}
           GROUP BY w.user_id, t.workspace_id, t.model`,
          [kind]
        )
      }
      await db.rawQuery(
        `INSERT INTO ai_usage (user_id, workspace_id, kind, model, input_tokens, output_tokens, created_at)
         SELECT user_id, NULL, 'carryover', model,
                COALESCE(SUM(input_tokens), 0), COALESCE(SUM(output_tokens), 0), NOW()
         FROM ai_spend_carryovers
         WHERE created_at >= ${monthStart}
         GROUP BY user_id, model`
      )
    })

    this.schema.raw(
      'CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email))'
    )
    this.schema.raw(
      'CREATE UNIQUE INDEX IF NOT EXISTS project_files_public_id_unique ON project_files (cloudinary_public_id)'
    )
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS project_files_public_id_unique')
    this.schema.raw('DROP INDEX IF EXISTS users_email_lower_unique')
    this.schema.dropTable('ai_usage')
  }
}
