import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sub_goals'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('goal_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('goals')
        .onDelete('CASCADE')
      table.text('title').notNullable().defaultTo('')
      table.text('details').notNullable().defaultTo('')
      table.boolean('done').notNullable().defaultTo(false)
      table.specificType('position', 'text COLLATE "C"').notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['goal_id', 'position'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
