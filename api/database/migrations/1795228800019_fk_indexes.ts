import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Indexes on foreign keys that had none, so deleting the parent (or
 * listing by it) doesn't scan the whole child table:
 * - alignment_checks.todo_id: set to null on every to-do delete, and the
 *   table grows by a row per check.
 * - api_keys.tokenable_id: a user's keys are listed by it, and removed with the user.
 * - users.last_workspace_id: set to null on every workspace delete.
 * Additive only, so it's safe on the shared database before a deploy.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('alignment_checks', (table) => {
      table.index(['todo_id'])
    })
    this.schema.alterTable('api_keys', (table) => {
      table.index(['tokenable_id'])
    })
    this.schema.alterTable('users', (table) => {
      table.index(['last_workspace_id'])
    })
  }

  async down() {
    this.schema.alterTable('alignment_checks', (table) => {
      table.dropIndex(['todo_id'])
    })
    this.schema.alterTable('api_keys', (table) => {
      table.dropIndex(['tokenable_id'])
    })
    this.schema.alterTable('users', (table) => {
      table.dropIndex(['last_workspace_id'])
    })
  }
}
