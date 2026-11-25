import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Notes, AI hints for to-dos, account name and the focus-timer default.
 * Additive only: the deployed app shares this database.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.text('display_name').nullable()
      /** Default length of the nav-bar focus timer. */
      table.integer('timer_minutes').notNullable().defaultTo(25)
    })

    this.schema.createTable('notes', (table) => {
      table.increments('id')
      table.text('title').notNullable().defaultTo('')
      table.text('body').notNullable().defaultTo('')
      table.specificType('position', 'text COLLATE "C"').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['position'])
    })

    this.schema.createTable('todo_hint_runs', (table) => {
      table.increments('id')
      table
        .integer('todo_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('todos')
        .onDelete('CASCADE')
      table
        .enu('status', ['queued', 'ready', 'error', 'skipped'], {
          useNative: false,
          enumName: 'todo_hint_run_status',
        })
        .notNullable()
      table.text('input_hash').notNullable()
      table.text('hint').notNullable().defaultTo('')
      table.jsonb('steps').notNullable().defaultTo('[]')
      table.string('model').nullable()
      table.integer('input_tokens').notNullable().defaultTo(0)
      table.integer('output_tokens').notNullable().defaultTo(0)
      table.text('error').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['todo_id', 'created_at'])
      table.index(['created_at'])
    })
  }

  async down() {
    this.schema.dropTable('todo_hint_runs')
    this.schema.dropTable('notes')
    this.schema.alterTable('users', (table) => {
      table.dropColumn('display_name')
      table.dropColumn('timer_minutes')
    })
  }
}
