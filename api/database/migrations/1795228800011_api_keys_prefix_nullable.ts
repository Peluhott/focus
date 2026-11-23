import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adonis' DbAccessTokensProvider inserts the key without `prefix`, which the
 * keys controller fills in right after. So the column has to allow null.
 */
export default class extends BaseSchema {
  protected tableName = 'api_keys'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('prefix', 32).nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('prefix', 32).notNullable().alter()
    })
  }
}
