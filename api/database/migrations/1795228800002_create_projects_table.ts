import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'projects'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.text('title').notNullable().defaultTo('')
      table.text('details').notNullable().defaultTo('')
      table
        .enu('status', ['planning', 'active', 'on_hold', 'done', 'archived'], {
          useNative: false,
          enumName: 'project_status',
        })
        .notNullable()
        .defaultTo('planning')
      table
        .integer('goal_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('goals')
        .onDelete('SET NULL')
      table.date('due_date').nullable()
      table.specificType('position', 'text COLLATE "C"').notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['position'])
      table.index(['goal_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
