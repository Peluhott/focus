import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('email', 254).notNullable().unique()
      table.string('password').notNullable()
      table.smallint('focus_limit').notNullable().defaultTo(3)
      table.boolean('ai_enabled').notNullable().defaultTo(true)

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
    this.schema.raw(
      'ALTER TABLE users ADD CONSTRAINT users_focus_limit_check CHECK (focus_limit IN (3, 5, 7))'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
