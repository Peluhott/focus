import { BaseSchema } from '@adonisjs/lucid/schema'

/** Rows that belong to a workspace directly (children go through their parent). */
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
 * Multi-user and Personal / Work workspaces (designhandoff WORK-MODE.md).
 * Every user has one workspace of each kind; goals, projects, to-dos, notes
 * and the AI's records belong to a workspace, which belongs to a user.
 *
 * Additive only: the deployed app shares this database. workspace_id stays
 * nullable and users.ai_enabled stays in place until a cleanup migration
 * after deploy (re-backfill nulls, set NOT NULL, drop users.ai_enabled).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('workspaces', (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .enu('kind', ['personal', 'work'], { useNative: false, enumName: 'workspace_kind' })
        .notNullable()
      table.boolean('ai_enabled').notNullable()
      /** Latest "I understand, turn on AI" in Work; every one is in ai_consents. */
      table.timestamp('work_ai_ack_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['user_id', 'kind'])
    })

    /** One row each time AI is turned on in Work after the warning (legal record). */
    this.schema.createTable('ai_consents', (table) => {
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
        .notNullable()
        .references('id')
        .inTable('workspaces')
        .onDelete('CASCADE')
      table.string('ip', 64).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
    })

    this.schema.alterTable('users', (table) => {
      table.string('last_workspace', 16).notNullable().defaultTo('personal')
      // 012 already ran with a default of 20; the design says 25.
      table.integer('timer_minutes').notNullable().defaultTo(25).alter()
    })

    for (const name of SCOPED) {
      this.schema.alterTable(name, (table) => {
        table
          .integer('workspace_id')
          .unsigned()
          .nullable()
          .references('id')
          .inTable('workspaces')
          .onDelete('CASCADE')
      })
    }

    this.schema.alterTable('goals', (t) => t.index(['workspace_id', 'status', 'position']))
    this.schema.alterTable('todos', (t) => t.index(['workspace_id', 'done', 'position']))
    this.schema.alterTable('projects', (t) => t.index(['workspace_id', 'position']))
    this.schema.alterTable('notes', (t) => t.index(['workspace_id', 'position']))
    this.schema.alterTable('todo_completions', (t) => t.index(['workspace_id', 'completed_at']))
    this.schema.alterTable('off_track_items', (t) => t.index(['workspace_id', 'status']))
    this.schema.alterTable('goal_suggestion_runs', (t) => t.index(['workspace_id', 'created_at']))
    this.schema.alterTable('goal_suggestions', (t) => t.index(['workspace_id', 'status']))
    this.schema.alterTable('alignment_checks', (t) => t.index(['workspace_id', 'created_at']))
    this.schema.alterTable('todo_hint_runs', (t) => t.index(['workspace_id', 'created_at']))

    this.defer(async (db) => {
      await db.rawQuery(`
        INSERT INTO workspaces (user_id, kind, ai_enabled, created_at, updated_at)
        SELECT id, 'personal', ai_enabled, NOW(), NOW() FROM users
        UNION ALL
        SELECT id, 'work', false, NOW(), NOW() FROM users
        ON CONFLICT (user_id, kind) DO NOTHING
      `)
      // Until now there was one user: all existing data is theirs (Personal).
      const first = `(SELECT w.id FROM workspaces w JOIN users u ON u.id = w.user_id
                       WHERE w.kind = 'personal' ORDER BY u.id LIMIT 1)`
      for (const name of ['goals', 'projects', 'todos', 'notes', 'off_track_items']) {
        await db.rawQuery(`UPDATE ${name} SET workspace_id = ${first} WHERE workspace_id IS NULL`)
      }
      await db.rawQuery(`
        UPDATE todo_completions c SET workspace_id = t.workspace_id
        FROM todos t WHERE c.todo_id = t.id AND c.workspace_id IS NULL`)
      await db.rawQuery(`
        UPDATE alignment_checks c SET workspace_id = t.workspace_id
        FROM todos t WHERE c.todo_id = t.id AND c.workspace_id IS NULL`)
      await db.rawQuery(`
        UPDATE todo_hint_runs h SET workspace_id = t.workspace_id
        FROM todos t WHERE h.todo_id = t.id AND h.workspace_id IS NULL`)
      for (const name of ['todo_completions', 'alignment_checks', 'todo_hint_runs']) {
        await db.rawQuery(`UPDATE ${name} SET workspace_id = ${first} WHERE workspace_id IS NULL`)
      }
      await db.rawQuery(
        `UPDATE goal_suggestion_runs SET workspace_id = ${first} WHERE workspace_id IS NULL`
      )
      await db.rawQuery(`
        UPDATE goal_suggestions s SET workspace_id = r.workspace_id
        FROM goal_suggestion_runs r WHERE s.run_id = r.id AND s.workspace_id IS NULL`)
    })
  }

  async down() {
    for (const name of SCOPED) {
      this.schema.alterTable(name, (table) => table.dropColumn('workspace_id'))
    }
    this.schema.alterTable('users', (table) => {
      table.dropColumn('last_workspace')
      table.integer('timer_minutes').notNullable().defaultTo(20).alter()
    })
    this.schema.dropTable('ai_consents')
    this.schema.dropTable('workspaces')
  }
}
