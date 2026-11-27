import db from '@adonisjs/lucid/services/db'
import aiConfig, { FALLBACK_PRICE, PRICES_PER_MTOK } from '#config/ai'
import { ownerOf } from './usage.js'

type SpendRow = { model: string | null; input: string | null; output: string | null }

/**
 * Estimated spend so far this calendar month (UTC), from the ai_usage
 * ledger: alignment checks, goal-suggestion runs and to-do hints share one
 * budget. With a user id, only that user's (all their workspaces, deleted
 * ones too).
 */
export async function monthSpendUsd(userId?: number): Promise<number> {
  const query = db
    .from('ai_usage')
    .select('model')
    .sum('input_tokens as input')
    .sum('output_tokens as output')
    .whereRaw(`created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`)
    .groupBy('model')
  if (userId !== undefined) query.where('user_id', userId)
  const rows: SpendRow[] = await query
  return rows.reduce((total, row) => {
    const price = (row.model && PRICES_PER_MTOK[row.model]) || FALLBACK_PRICE
    return (
      total + (Number(row.input ?? 0) * price.input + Number(row.output ?? 0) * price.output) / 1e6
    )
  }, 0)
}

/**
 * Circuit breaker and spend caps (spec "Optional by design"). One per worker
 * process: after 5 outages in a row (network, timeout, 429, 5xx; never a
 * bad answer caused by the input) it pauses for 15 minutes, it pauses
 * everyone while the month's spend is over AI_MONTHLY_BUDGET_USD, and it
 * pauses one user while theirs is over AI_USER_MONTHLY_BUDGET_USD.
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
    const owner = await ownerOf(workspaceId)
    if (owner === null) return 'AI checks are paused: the workspace is gone.'
    if ((await monthSpendUsd(owner)) >= aiConfig.userMonthlyBudgetUsd) {
      return 'AI checks are paused: your monthly AI allowance is used up.'
    }
    return null
  }

  /** The breaker is open: stop calling the model, even mid-retry. */
  get tripped() {
    return this.now() < this.pausedUntil
  }

  /** Milliseconds until the breaker closes again (0 when it's closed). */
  get resumesInMs() {
    return Math.max(0, this.pausedUntil - this.now())
  }

  succeeded() {
    this.failures = 0
  }

  /** Count an outage. Bad answers (ProviderError kind "content") must not be counted. */
  failed() {
    this.failures++
    if (this.failures >= aiConfig.breakerFailures) {
      this.pausedUntil = this.now() + aiConfig.breakerPauseMs
      this.failures = 0
    }
  }
}
