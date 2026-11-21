import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'todos'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.text('title').notNullable()
      table.text('notes').notNullable().defaultTo('')
      table.date('date').nullable()
      table.specificType('position', 'text COLLATE "C"').notNullable()
      table.boolean('done').notNullable().defaultTo(false)
      table.timestamp('done_at', { useTz: true }).nullable()

      /**
       * AI alignment. alignment_status stays null while the AI check is off.
       */
      table
        .enu('alignment_status', ['pending', 'aligned', 'unaligned', 'dismissed', 'error'], {
          useNative: false,
          enumName: 'todo_alignment_status',
        })
        .nullable()
      table.text('alignment_reason').nullable()
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
      table
        .enu('alignment_source', ['ai', 'manual'], {
          useNative: false,
          enumName: 'todo_alignment_source',
        })
        .nullable()
      table.timestamp('checked_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['done', 'position'])
      table.index(['alignment_status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
