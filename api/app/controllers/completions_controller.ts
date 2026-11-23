import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import TodoCompletion from '#models/todo_completion'
import { recount } from '#services/completions'
import { listCompletionsValidator } from '#validators/todo'

/**
 * Completions: one row per check-off, normal or recurring (feature spec
 * "How completions count").
 */
export default class CompletionsController {
  /**
   * GET /completions?from=YYYY-MM-DD&to=YYYY-MM-DD: completions in that
   * range (inclusive days, UTC), newest first, with the total.
   */
  async index({ request }: HttpContext) {
    const { from, to } = await listCompletionsValidator.validate(request.qs())
    const query = TodoCompletion.query().orderBy('completed_at', 'desc').orderBy('id', 'desc')
    if (from) query.where('completed_at', '>=', DateTime.fromISO(from, { zone: 'utc' }).toSQL()!)
    if (to) {
      const end = DateTime.fromISO(to, { zone: 'utc' }).plus({ days: 1 })
      query.where('completed_at', '<', end.toSQL()!)
    }
    const rows = await query
    return { data: rows.map((r) => r.serialize()), total: rows.length }
  }

  /** DELETE /completions/:id: Undo a check-off (a tap by mistake). */
  async destroy({ params, response }: HttpContext) {
    const completion = await TodoCompletion.findOrFail(params.id)
    await completion.delete()
    if (completion.todoId !== null) await recount(completion.todoId)
    return response.noContent()
  }
}
