import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Off-track backlog and goal suggestions (docs "Off-track Backlog, Goal
 * Suggestions & Calendar"). Checking off a red to-do moves it into the
 * backlog instead of completing it; completing a goal or raising the focus
 * limit asks the AI for up to 3 goals built from recurring backlog themes.
 */
export default class extends BaseSchema {
  async up() {
    // A to-do moved to the backlog leaves the list (done = true) but is not a
    // completion: it never counts toward the climb or shows as completed.
    this.schema.alterTable('todos', (table) => {
      table.boolean('off_track').notNullable().defaultTo(false)
    })

    this.schema.createTable('off_track_items', (table) => {
      table.increments('id')
      table
        .integer('todo_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('todos')
        .onDelete('SET NULL')
      table.text('title_snapshot').notNullable()
      table.text('notes_snapshot').notNullable().defaultTo('')
      table.text('reason').nullable()
      table
        .enu('status', ['open', 'used', 'cleared'], {
          useNative: false,
          enumName: 'off_track_status',
        })
        .notNullable()
        .defaultTo('open')
      table.timestamp('moved_at', { useTz: true }).notNullable()
      table
        .integer('used_in_goal_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('goals')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['status', 'moved_at'])
    })

    this.schema.createTable('goal_suggestion_runs', (table) => {
      table.increments('id')
      table
        .enu('trigger', ['goal_completed', 'limit_raised'], {
          useNative: false,
          enumName: 'goal_suggestion_trigger',
        })
        .notNullable()
      table
        .integer('trigger_goal_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('goals')
        .onDelete('SET NULL')
      table
        .enu('status', ['queued', 'ready', 'empty', 'error', 'skipped'], {
          useNative: false,
          enumName: 'goal_suggestion_run_status',
        })
        .notNullable()
      table.integer('item_count').notNullable().defaultTo(0)
      table.string('model').nullable()
      table.integer('input_tokens').notNullable().defaultTo(0)
      table.integer('output_tokens').notNullable().defaultTo(0)
      table.text('error').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['created_at'])
    })

    this.schema.createTable('goal_suggestions', (table) => {
      table.increments('id')
      table
        .integer('run_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('goal_suggestion_runs')
        .onDelete('CASCADE')
      table.text('title').notNullable()
      table.text('details').notNullable().defaultTo('')
      table.jsonb('sub_goals').notNullable().defaultTo('[]')
      table.jsonb('item_ids').notNullable().defaultTo('[]')
      table.text('rationale').notNullable().defaultTo('')
      table
        .enu('status', ['open', 'accepted', 'dismissed'], {
          useNative: false,
          enumName: 'goal_suggestion_status',
        })
        .notNullable()
        .defaultTo('open')
      table
        .integer('accepted_goal_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('goals')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['status'])
    })
  }

  async down() {
    this.schema.dropTable('goal_suggestions')
    this.schema.dropTable('goal_suggestion_runs')
    this.schema.dropTable('off_track_items')
    this.schema.alterTable('todos', (table) => {
      table.dropColumn('off_track')
    })
  }
}
