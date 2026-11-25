import db from '@adonisjs/lucid/services/db'
import aiConfig, { FALLBACK_PRICE, PRICES_PER_MTOK } from '#config/ai'

type SpendRow = { model: string | null; input: string | null; output: string | null }

const SPEND_TABLES = ['alignment_checks', 'goal_suggestion_runs', 'todo_hint_runs'] as const

const spendThisMonth = (table: string, userId?: number): Promise<SpendRow[]> => {
  const query = db
    .from(table)
    .select(`${table}.model`)
    .sum(`${table}.input_tokens as input`)
    .sum(`${table}.output_tokens as output`)
    .whereRaw(
      `${table}.created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`
    )
    .groupBy(`${table}.model`)
  if (userId !== undefined) {
    query
      .join('workspaces', 'workspaces.id', `${table}.workspace_id`)
      .where('workspaces.user_id', userId)
  }
  return query
}

/**
 * Estimated spend so far this calendar month (UTC): alignment checks,
 * goal-suggestion runs and to-do hints, which share one budget. With a
 * user id, only that user's (both workspaces).
 */
export async function monthSpendUsd(userId?: number): Promise<number> {
  const rows: SpendRow[] = []
  for (const table of SPEND_TABLES) rows.push(...(await spendThisMonth(table, userId)))
  return rows.reduce((total, row) => {
    const price = (row.model && PRICES_PER_MTOK[row.model]) || FALLBACK_PRICE
    return (
      total + (Number(row.input ?? 0) * price.input + Number(row.output ?? 0) * price.output) / 1e6
    )
  }, 0)
}

/**
 * Circuit breaker and spend caps (spec "Optional by design"). One per worker
 * process: after 5 failed calls in a row it pauses for 15 minutes, it
 * pauses everyone while the month's spend is over AI_MONTHLY_BUDGET_USD,
 * and it pauses one user while theirs is over AI_USER_MONTHLY_BUDGET_USD.
 */
export class AlignmentGuard {
  private failures = 0
  private pausedUntil = 0

  constructor(private now = () => Date.now()) {}

  /** Why calls for this workspace are paused right now, or null when they may run. */
  async blocked(workspaceId: number): Promise<string | null> {
    if (this.tripped) {
      return 'AI checks are paused after repeated failures. They resume shortly.'
    }
    if ((await monthSpendUsd()) >= aiConfig.monthlyBudgetUsd) {
      return 'AI checks are paused: the monthly AI budget is used up.'
    }
    const owner = await db.from('workspaces').where('id', workspaceId).select('user_id').first()
    if (!owner) return 'AI checks are paused: the workspace is gone.'
    if ((await monthSpendUsd(owner.user_id)) >= aiConfig.userMonthlyBudgetUsd) {
      return 'AI checks are paused: your monthly AI allowance is used up.'
    }
    return null
  }

  /** The breaker is open: stop calling the model, even mid-retry. */
  get tripped() {
    return this.now() < this.pausedUntil
  }

  succeeded() {
    this.failures = 0
  }

  failed() {
    this.failures++
    if (this.failures >= aiConfig.breakerFailures) {
      this.pausedUntil = this.now() + aiConfig.breakerPauseMs
      this.failures = 0
    }
  }
}
