import env from '#start/env'

/**
 * Gemini list prices in USD per million tokens (Standard tier, Nov 2026).
 * Output includes thinking tokens. Used for the monthly spend cap only.
 */
export const PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
  'gemini-3.5-flash-lite': { input: 0.3, output: 2.5 },
}
/** Unknown models are costed high, so the cap errs on the safe side. */
export const FALLBACK_PRICE = { input: 1, output: 5 }

/**
 * AI alignment check (spec "AI alignment check"). It runs only when
 * AI_ENABLED is true *and* GEMINI_API_KEY is set; the Settings toggle can
 * then switch it off per account.
 */
const aiConfig = {
  enabled: env.get('AI_ENABLED') ?? false,
  apiKey: env.get('GEMINI_API_KEY'),
  model: env.get('AI_MODEL') ?? 'gemini-3.1-flash-lite',
  monthlyBudgetUsd: env.get('AI_MONTHLY_BUDGET_USD') ?? 5,

  /** Each model call: 10 s timeout, 3 attempts (2 retries) with backoff. */
  timeoutMs: 10_000,
  retryDelaysMs: [1_000, 3_000],

  /** After 5 failures in a row, pause checks for 15 minutes. */
  breakerFailures: 5,
  breakerPauseMs: 15 * 60_000,

  /** Below this, an "unaligned" verdict is treated as unsure: no red. */
  flagConfidence: 0.6,

  /** Queue delays: a to-do edit waits 1.5 s; goal/project edits batch for 5 s. */
  todoDelayMs: 1_500,
  contextDelayMs: 5_000,

  /** What the model sees is trimmed to these sizes. */
  limits: { details: 400, notes: 1_000, subGoals: 15, tasks: 15, reason: 140 },
}

export default aiConfig
