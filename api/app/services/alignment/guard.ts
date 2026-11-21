import db from '@adonisjs/lucid/services/db'
import aiConfig, { FALLBACK_PRICE, PRICES_PER_MTOK } from '#config/ai'

/** Estimated spend so far this calendar month (UTC), from alignment_checks. */
export async function monthSpendUsd(): Promise<number> {
  const rows: { model: string; input: string | null; output: string | null }[] = await db
    .from('alignment_checks')
    .select('model')
    .sum('input_tokens as input')
    .sum('output_tokens as output')
    .whereRaw(`created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`)
    .groupBy('model')
  return rows.reduce((total, row) => {
    const price = PRICES_PER_MTOK[row.model] ?? FALLBACK_PRICE
    return (
      total + (Number(row.input ?? 0) * price.input + Number(row.output ?? 0) * price.output) / 1e6
    )
  }, 0)
}

/**
 * Circuit breaker and spend cap (spec "Optional by design"). One per worker
 * process: after 5 failed calls in a row it pauses for 15 minutes, and it
 * pauses while the month's spend is over AI_MONTHLY_BUDGET_USD.
 */
export class AlignmentGuard {
  private failures = 0
  private pausedUntil = 0

  constructor(private now = () => Date.now()) {}

  /** Why checks are paused right now, or null when they may run. */
  async blocked(): Promise<string | null> {
    if (this.tripped) {
      return 'AI checks are paused after repeated failures. They resume shortly.'
    }
    if ((await monthSpendUsd()) >= aiConfig.monthlyBudgetUsd) {
      return 'AI checks are paused: the monthly AI budget is used up.'
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
