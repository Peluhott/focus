import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One row per model call: cost tracking, the spend cap and evals.
 */
export default class extends BaseSchema {
  protected tableName = 'alignment_checks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('todo_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('todos')
        .onDelete('SET NULL')
      table.string('model').notNullable()
      table.string('context_version', 64).notNullable()
      table.jsonb('verdict').nullable()
      table.integer('input_tokens').notNullable().defaultTo(0)
      table.integer('output_tokens').notNullable().defaultTo(0)
      table.integer('latency_ms').notNullable().defaultTo(0)

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
