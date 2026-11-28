import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Re-check bookkeeping on workspaces:
 * - context_changed_at: the last goal or sub-goal change that asked for a
 *   re-check. The worker waits until it's been quiet for a while, so an
 *   editing session re-grades the to-dos once.
 * - alignment_version: the model and prompt the last full re-check used.
 *   The worker re-checks on start only where this differs.
 * Additive only, so it's safe on the shared database before a deploy.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('workspaces', (table) => {
      table.timestamp('context_changed_at', { useTz: true }).nullable()
      table.string('alignment_version', 200).nullable()
    })
  }

  async down() {
    this.schema.alterTable('workspaces', (table) => {
      table.dropColumn('context_changed_at')
      table.dropColumn('alignment_version')
    })
  }
}
