import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import AppError from '#exceptions/app_error'

/**
 * GET /stats/completions: the all-time numbers behind "Focus so far", for
 * the request's workspace. Read from todo_completions, one row per
 * check-off (normal or recurring), so 5 check-offs of one recurring to-do
 * count as 5. Only completions logged while the AI check was on are counted.
 * total counts each completion once; by_goal counts it toward every goal it
 * matched (the page shows the active ones); off_goal is counted completions
 * with no goal link (the page no longer shows it).
 */
export default class StatsController {
  async completions({ workspace }: HttpContext) {
    const [totals, byGoal] = await Promise.all([
      db
        .from('todo_completions')
        .where('workspace_id', workspace.id)
        .where('counted', true)
        .select(
          db.raw('count(*) as total'),
          db.raw("count(*) filter (where goal_ids = '{}') as off_goal")
        )
        .first(),
      db.rawQuery<{ rows: { goal_id: number; count: string }[] }>(
        `SELECT goal_id, count(*) AS count
         FROM todo_completions, unnest(goal_ids) AS goal_id
         WHERE counted = true AND workspace_id = ?
         GROUP BY goal_id`,
        [workspace.id]
      ),
    ])
    return {
      total: Number(totals?.total ?? 0),
      by_goal: byGoal.rows.map((r) => ({
        goal_id: Number(r.goal_id),
        count: Number(r.count),
      })),
      off_goal: Number(totals?.off_goal ?? 0),
    }
  }

  /**
   * GET /stats/today?since=<ISO timestamp>: how many check-offs (normal or
   * recurring, counted or not) this workspace logged since `since`, the
   * caller's local midnight. Drives the To-dos page's "N done today".
   */
  async today({ request, workspace }: HttpContext) {
    const since = DateTime.fromISO(String(request.input('since') ?? ''))
    if (!since.isValid) throw AppError.validation('Give since as an ISO timestamp.')
    const row = await db
      .from('todo_completions')
      .where('workspace_id', workspace.id)
      .where('completed_at', '>=', since.toJSDate())
      .count('* as count')
      .first()
    return { count: Number(row?.count ?? 0) }
  }
}
