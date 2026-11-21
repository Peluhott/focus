import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `position` columns hold fractional-indexing keys. They must sort by byte
 * value, so they use the "C" collation rather than the database default.
 */
export default class extends BaseSchema {
  protected tableName = 'goals'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.text('title').notNullable().defaultTo('')
      table.text('details').notNullable().defaultTo('')
      table
        .enu('status', ['active', 'completed', 'archived'], {
          useNative: false,
          enumName: 'goal_status',
        })
        .notNullable()
        .defaultTo('active')
      table.specificType('position', 'text COLLATE "C"').notNullable()
      table.timestamp('completed_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['status', 'position'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
