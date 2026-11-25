import type { HttpContext } from '@adonisjs/core/http'
import { findInWs, inWs } from '#services/scoped'
import OffTrackItem, { OFF_TRACK_STATUSES } from '#models/off_track_item'
import { listStatusValidator } from '#validators/suggestion'

const listValidator = listStatusValidator(OFF_TRACK_STATUSES)

/**
 * The off-track backlog: red to-dos you checked off. A record, not a second
 * to-do list, so the only actions are removing entries.
 */
export default class OffTrackController {
  /** GET /off-track?status=open (default) | used | cleared | all. Newest first. */
  async index({ request, workspace }: HttpContext) {
    const { status = 'open' } = await listValidator.validate(request.qs())
    const query = inWs(OffTrackItem, workspace).orderBy('moved_at', 'desc').orderBy('id', 'desc')
    if (status !== 'all') query.where('status', status)
    const rows = await query
    return { data: rows.map((r) => r.serialize()), next_cursor: null }
  }

  /** DELETE /off-track/:id: remove one entry by hand (kept as "cleared"). */
  async destroy({ params, response, workspace }: HttpContext) {
    const item = await findInWs(OffTrackItem, workspace, params.id)
    if (item.status === 'open') {
      item.status = 'cleared'
      await item.save()
    }
    return response.noContent()
  }

  /** POST /off-track/clear: "Clear all" open entries. */
  async clear({ workspace }: HttpContext) {
    const cleared = await inWs(OffTrackItem, workspace)
      .where('status', 'open')
      .update({ status: 'cleared' })
    return { cleared: Number(Array.isArray(cleared) ? cleared[0] : cleared) || 0 }
  }
}
