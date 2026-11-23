import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Project files, recurring to-dos and multi-goal matching (docs "Project
 * Files, Recurring To-dos & Multi-goal Matching").
 *
 * Additive only: the database is shared with the deployed app, so the old
 * columns (todos.matched_goal_id, matched_project_id, counted) stay in place,
 * unused by the new code, until a later cleanup migration drops them.
 */
export default class extends BaseSchema {
  async up() {
    // Metadata only; the file itself lives in Cloudinary.
    this.schema.createTable('project_files', (table) => {
      table.increments('id')
      table
        .integer('project_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE')
      table.text('name').notNullable()
      table.text('cloudinary_public_id').notNullable()
      table.string('resource_type', 16).notNullable()
      table.string('format', 32).nullable()
      table.bigInteger('bytes').notNullable().defaultTo(0)
      table.timestamp('uploaded_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['project_id', 'uploaded_at'])
    })

    // One row per check-off, normal or recurring. Kept when the to-do is
    // deleted. `counted` and `goal_ids` snapshot what the climb needs.
    this.schema.createTable('todo_completions', (table) => {
      table.increments('id')
      table
        .integer('todo_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('todos')
        .onDelete('SET NULL')
      table.text('title_snapshot').notNullable()
      table.timestamp('completed_at', { useTz: true }).notNullable()
      table.boolean('counted').notNullable().defaultTo(false)
      table.specificType('goal_ids', 'integer[]').notNullable().defaultTo('{}')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['completed_at'])
      table.index(['todo_id'])
    })

    // A to-do's links to the goals it serves (replaces matched_goal_id).
    this.schema.createTable('todo_matches', (table) => {
      table.increments('id')
      table
        .integer('todo_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('todos')
        .onDelete('CASCADE')
      table.string('target_type', 16).notNullable().defaultTo('goal')
      table.integer('target_id').notNullable()
      table.float('confidence').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.unique(['todo_id', 'target_type', 'target_id'])
      table.index(['target_type', 'target_id'])
    })

    this.schema.alterTable('todos', (table) => {
      table.boolean('recurring').notNullable().defaultTo(false)
      table.integer('completion_count').notNullable().defaultTo(0)
      table.timestamp('last_completed_at', { useTz: true }).nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        INSERT INTO todo_matches (todo_id, target_type, target_id, confidence, created_at)
        SELECT id, 'goal', matched_goal_id, NULL, NOW()
        FROM todos WHERE matched_goal_id IS NOT NULL
      `)
      await db.rawQuery(`
        INSERT INTO todo_completions (todo_id, title_snapshot, completed_at, counted, goal_ids, created_at)
        SELECT id, title, COALESCE(done_at, updated_at), counted,
               CASE WHEN matched_goal_id IS NULL THEN '{}'::integer[] ELSE ARRAY[matched_goal_id] END,
               NOW()
        FROM todos WHERE done = true AND off_track = false
      `)
      await db.rawQuery(`
        UPDATE todos SET completion_count = 1, last_completed_at = COALESCE(done_at, updated_at)
        WHERE done = true AND off_track = false
      `)
    })
  }

  async down() {
    this.schema.alterTable('todos', (table) => {
      table.dropColumn('recurring')
      table.dropColumn('completion_count')
      table.dropColumn('last_completed_at')
    })
    this.schema.dropTable('todo_matches')
    this.schema.dropTable('todo_completions')
    this.schema.dropTable('project_files')
  }
}
