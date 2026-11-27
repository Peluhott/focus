import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Goals and sub-goals no longer have details: erase the stored text. The
 * columns stay (NOT NULL, now always '') until a later deploy drops them.
 * One-way: the text can't be brought back.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.from('goals').whereNot('details', '').update({ details: '' })
      await db.from('sub_goals').whereNot('details', '').update({ details: '' })
    })
  }

  async down() {
    // Nothing to restore.
  }
}
