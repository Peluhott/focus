import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'tasks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('project_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE')
      table.text('title').notNullable().defaultTo('')
      table.text('details').notNullable().defaultTo('')
      table
        .enu('status', ['pending', 'complete'], { useNative: false, enumName: 'task_status' })
        .notNullable()
        .defaultTo('pending')
      table.date('due_date').nullable()
      table.specificType('position', 'text COLLATE "C"').notNullable()
      table.timestamp('completed_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['project_id', 'status', 'position'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
