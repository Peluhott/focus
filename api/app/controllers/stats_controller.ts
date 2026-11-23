import db from '@adonisjs/lucid/services/db'

/**
 * GET /stats/completions: the all-time numbers behind "Focus so far".
 * Read from todo_completions, one row per check-off (normal or recurring),
 * so 5 check-offs of one recurring to-do count as 5. Only completions logged
 * while the AI check was on are counted.
 * total counts each completion once; by_goal counts it toward every goal it
 * matched (the page shows the active ones); off_goal is counted completions
 * with no goal link.
 */
export default class StatsController {
  async completions() {
    const [totals, byGoal] = await Promise.all([
      db
        .from('todo_completions')
        .where('counted', true)
        .select(
          db.raw('count(*) as total'),
          db.raw("count(*) filter (where goal_ids = '{}') as off_goal")
        )
        .first(),
      db.rawQuery<{ rows: { goal_id: number; count: string }[] }>(
        `SELECT goal_id, count(*) AS count
         FROM todo_completions, unnest(goal_ids) AS goal_id
         WHERE counted = true
         GROUP BY goal_id`
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
}
