import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The "Focus so far" climb counts completed to-dos, but only the ones
 * completed while the AI check was on. Whether a completion counts is
 * decided when it happens, so it's stored here. Existing completions are
 * backfilled as counted, so the climb starts from your history.
 */
export default class extends BaseSchema {
  protected tableName = 'todos'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('counted').notNullable().defaultTo(false)
    })
    this.defer(async (db) => {
      await db.from(this.tableName).where('done', true).update({ counted: true })
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('counted')
    })
  }
}
