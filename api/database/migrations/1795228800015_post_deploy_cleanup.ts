import { BaseSchema } from '@adonisjs/lucid/schema'
import { generateKeyBetween } from 'fractional-indexing'

/** Rows that belong to a workspace directly (as in 1795228800013). */
const SCOPED = [
  'goals',
  'projects',
  'todos',
  'notes',
  'todo_completions',
  'off_track_items',
  'goal_suggestion_runs',
  'goal_suggestions',
  'alignment_checks',
  'todo_hint_runs',
] as const

/**
 * The cleanup that waited for the workspace code to be deployed (013, 014
 * stayed additive while the old deploy shared this database):
 * - every scoped row has a workspace (re-backfilled, then NOT NULL);
 * - every workspace has a name and a position (NOT NULL);
 * - unused columns go: todos.matched_goal_id / matched_project_id / counted
 *   (links live in todo_matches, completions in todo_completions), and
 *   users.ai_enabled / last_workspace (now per workspace / last_workspace_id).
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      // Rows the old deploy wrote without a workspace: the first user's
      // Personal workspace (else that user's first one), as in 013.
      const first = `(SELECT w.id FROM workspaces w JOIN users u ON u.id = w.user_id
                       ORDER BY u.id, (w.kind = 'personal') DESC NULLS LAST, w.position, w.id
                       LIMIT 1)`
      await db.rawQuery(`
        UPDATE todo_completions c SET workspace_id = t.workspace_id
        FROM todos t WHERE c.todo_id = t.id AND c.workspace_id IS NULL AND t.workspace_id IS NOT NULL`)
      await db.rawQuery(`
        UPDATE goal_suggestions s SET workspace_id = r.workspace_id
        FROM goal_suggestion_runs r
        WHERE s.run_id = r.id AND s.workspace_id IS NULL AND r.workspace_id IS NOT NULL`)
      for (const name of SCOPED) {
        await db.rawQuery(`UPDATE ${name} SET workspace_id = ${first} WHERE workspace_id IS NULL`)
      }

      await db.rawQuery(`
        UPDATE workspaces SET name = CASE WHEN kind = 'work' THEN 'Work' ELSE 'Personal' END
        WHERE name IS NULL`)
      // Positions for rows that have none: after the user's last one.
      const missing = await db
        .from('workspaces')
        .whereNull('position')
        .orderBy('user_id')
        .orderBy('id')
        .select('id', 'user_id')
      for (const row of missing) {
        const last = await db
          .from('workspaces')
          .where('user_id', row.user_id)
          .whereNotNull('position')
          .orderBy('position', 'desc')
          .first()
        await db
          .from('workspaces')
          .where('id', row.id)
          .update({ position: generateKeyBetween(last?.position ?? null, null) })
      }
    })

    for (const name of SCOPED) {
      this.schema.alterTable(name, (table) => table.dropNullable('workspace_id'))
    }
    this.schema.alterTable('workspaces', (table) => {
      table.dropNullable('name')
      table.dropNullable('position')
    })
    this.schema.alterTable('todos', (table) => {
      table.dropColumn('matched_goal_id')
      table.dropColumn('matched_project_id')
      table.dropColumn('counted')
    })
    this.schema.alterTable('users', (table) => {
      table.dropColumn('ai_enabled')
      table.dropColumn('last_workspace')
    })
  }

  async down() {
    this.schema.alterTable('users', (table) => {
      table.boolean('ai_enabled').notNullable().defaultTo(true)
      table.string('last_workspace', 16).notNullable().defaultTo('personal')
    })
    this.schema.alterTable('todos', (table) => {
      table
        .integer('matched_goal_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('goals')
        .onDelete('SET NULL')
      table
        .integer('matched_project_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('projects')
        .onDelete('SET NULL')
      table.boolean('counted').notNullable().defaultTo(false)
    })
    this.schema.alterTable('workspaces', (table) => {
      table.setNullable('name')
      table.setNullable('position')
    })
    for (const name of SCOPED) {
      this.schema.alterTable(name, (table) => table.setNullable('workspace_id'))
    }
  }
}
