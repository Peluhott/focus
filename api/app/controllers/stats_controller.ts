import db from '@adonisjs/lucid/services/db'

/**
 * GET /stats/completions: the all-time numbers behind "Focus so far".
 * Only completions made while the AI check was on are counted.
 * by_goal covers every goal with counted completions (the page shows the
 * active ones); off_goal is counted completions with no goal link.
 */
export default class StatsController {
  async completions() {
    const rows: { goal_id: number | null; count: string | number }[] = await db
      .from('todos')
      .where('done', true)
      .where('counted', true)
      .select('matched_goal_id as goal_id')
      .count('* as count')
      .groupBy('matched_goal_id')

    let total = 0
    let offGoal = 0
    const byGoal: { goal_id: number; count: number }[] = []
    for (const row of rows) {
      const count = Number(row.count)
      total += count
      if (row.goal_id === null) offGoal += count
      else byGoal.push({ goal_id: row.goal_id, count })
    }
    return { total, by_goal: byGoal, off_goal: offGoal }
  }
}
