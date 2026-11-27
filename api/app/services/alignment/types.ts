/**
 * The provider interface (spec "Model and prompt"): swap the model by writing
 * another AlignmentProvider. Nothing here depends on Gemini.
 */

/** What the model returns, after schema validation. */
export type Verdict = {
  aligned: boolean
  confidence: number
  /**
   * Every active goal the to-do advances. To-dos match goals only; projects
   * are evidence for their goal.
   */
  matches: { type: 'goal'; id: number; confidence: number }[]
  reason: string
  /** Single-match verdicts cached before multi-goal matching. */
  match?: { type: 'goal' | 'none'; id: number | null }
}

export type TodoInput = { title: string; notes: string }

/**
 * The active goals a to-do is compared with, kept small on purpose: each
 * goal's title, short details, a few sub-goal titles and the titles of its
 * planning/active projects (evidence for the goal; never a match on their
 * own). Project details and tasks are left out: they rarely change a
 * verdict, and every change to them would re-check every to-do.
 */
export type AlignmentContext = {
  goals: {
    id: number
    title: string
    details: string
    sub_goals: string[]
    projects: { title: string }[]
  }[]
  /** Hash of the goals snapshot; a new version means old verdicts are stale. */
  version: string
}

export type Usage = { inputTokens: number; outputTokens: number }

export type ProviderResult = { verdict: Verdict; usage: Usage; latencyMs: number }

/** Several to-dos checked in one call; `key` is how the answer refers to each. */
export type BatchItem = { key: string; input: TodoInput }

/** Verdicts by item key. A key the model left out is missing from the map. */
export type BatchResult = { verdicts: Map<string, Verdict>; usage: Usage; latencyMs: number }

export interface AlignmentProvider {
  readonly model: string
  classifyAlignment(todo: TodoInput, context: AlignmentContext): Promise<ProviderResult>
  /** Optional: one call for many to-dos (the context is sent once). */
  classifyBatch?(items: BatchItem[], context: AlignmentContext): Promise<BatchResult>
}

/**
 * Why a call failed. "outage": the provider is down or slow (network,
 * timeout, 429, 5xx): retried, and counted by the circuit breaker.
 * "content": the call worked but the answer didn't (bad JSON, cut off,
 * blocked, wrong shape, other 4xx): usually caused by the input, so it
 * never trips the breaker.
 */
export type FailureKind = 'outage' | 'content'

/** A failed call. `usage` is set when the provider still billed tokens. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly usage: Usage | null = null,
    readonly latencyMs = 0,
    readonly kind: FailureKind = 'outage'
  ) {
    super(message)
  }
}
