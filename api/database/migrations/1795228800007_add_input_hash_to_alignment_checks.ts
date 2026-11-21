import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Cache key for alignment results: a hash of the model, the to-do's text and
 * the context_version. Unchanged items reuse the last verdict instead of
 * calling the model again.
 */
export default class extends BaseSchema {
  protected tableName = 'alignment_checks'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('input_hash', 64).nullable().index()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('input_hash')
    })
  }
}
