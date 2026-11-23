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
 * The active goals a to-do is compared with. Each goal carries its linked
 * planning/active projects (with pending tasks) as extra evidence; projects
 * are never a match on their own.
 */
export type AlignmentContext = {
  goals: {
    id: number
    title: string
    details: string
    sub_goals: string[]
    projects: { title: string; details: string; pending_tasks: string[] }[]
  }[]
  /** Hash of the goals snapshot; a new version means old verdicts are stale. */
  version: string
}

export type Usage = { inputTokens: number; outputTokens: number }

export type ProviderResult = { verdict: Verdict; usage: Usage; latencyMs: number }

export interface AlignmentProvider {
  readonly model: string
  classifyAlignment(todo: TodoInput, context: AlignmentContext): Promise<ProviderResult>
}

/** A failed call. `usage` is set when the provider still billed tokens. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly usage: Usage | null = null,
    readonly latencyMs = 0
  ) {
    super(message)
  }
}
