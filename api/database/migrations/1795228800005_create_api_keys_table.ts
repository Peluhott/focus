import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * API keys. The columns Adonis' DbAccessTokensProvider expects (tokenable_id,
 * type, name, hash, abilities, last_used_at, expires_at), plus `prefix` for
 * recognising a key in the list and `revoked_at` so revoked keys stay visible.
 * `abilities` holds the scopes.
 */
export default class extends BaseSchema {
  protected tableName = 'api_keys'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('tokenable_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('type').notNullable()
      table.string('name').notNullable()
      table.string('prefix', 32).notNullable()
      table.string('hash').notNullable().unique()
      table.text('abilities').notNullable()
      table.timestamp('last_used_at', { useTz: true }).nullable()
      table.timestamp('expires_at', { useTz: true }).nullable()
      table.timestamp('revoked_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
