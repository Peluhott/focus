import { setTimeout as sleep } from 'node:timers/promises'
import logger from '@adonisjs/core/services/logger'
import type { AlignmentGuard } from './guard.js'
import { ProviderError, type Usage } from './types.js'
import { recordUsage, type UsageKind } from './usage.js'

export type Attempt<T> = { value: T; usage: Usage; latencyMs: number }

export type CallOutcome<T> = {
  /** The answer, or null when every attempt failed. */
  value: T | null
  /** Tokens billed over all attempts. */
  usage: Usage
  latencyMs: number
  /** Stopped because the circuit breaker opened (not because the answers were bad). */
  paused: boolean
}

/**
 * One model call with retries, shared by the alignment check, goal
 * suggestions and hints. Every attempt's tokens go to the ai_usage ledger
 * right away, so a crash after a paid call still counts toward the caps.
 *
 * - outage (network, timeout, 429, 5xx): counts toward the circuit breaker
 *   and is retried with backoff.
 * - content (bad JSON, cut off, wrong shape): caused by the input, so it
 *   never counts toward the breaker; retried at most `contentRetries` times.
 */
export async function callModel<T>(options: {
  guard: AlignmentGuard
  workspaceId: number
  kind: UsageKind
  model: string
  retryDelaysMs: number[]
  contentRetries: number
  attempt: () => Promise<Attempt<T>>
  log: Record<string, unknown>
}): Promise<CallOutcome<T>> {
  const { guard, retryDelaysMs } = options
  const total: Usage = { inputTokens: 0, outputTokens: 0 }
  let latencyMs = 0
  const bill = async (usage: Usage | null) => {
    total.inputTokens += usage?.inputTokens ?? 0
    total.outputTokens += usage?.outputTokens ?? 0
    await recordUsage({
      workspaceId: options.workspaceId,
      kind: options.kind,
      model: options.model,
      usage,
    }).catch((error) => logger.error({ err: error }, 'could not record AI usage'))
  }

  const attempts = retryDelaysMs.length + 1
  let contentFailures = 0
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const result = await options.attempt()
      latencyMs += result.latencyMs
      await bill(result.usage)
      guard.succeeded()
      return { value: result.value, usage: total, latencyMs, paused: false }
    } catch (error) {
      const failure = error instanceof ProviderError ? error : null
      latencyMs += failure?.latencyMs ?? 0
      await bill(failure?.usage ?? null)
      const kind = failure?.kind ?? 'outage'
      logger.warn(
        { ...options.log, attempt, kind, err: (error as Error).message },
        `${options.kind} attempt failed`
      )
      if (kind === 'content') {
        // A bad answer isn't the provider being down: no breaker, few retries.
        if (++contentFailures > options.contentRetries) break
        continue
      }
      guard.failed()
      if (guard.tripped) return { value: null, usage: total, latencyMs, paused: true }
      if (attempt < attempts) await sleep(retryDelaysMs[attempt - 1])
    }
  }
  return { value: null, usage: total, latencyMs, paused: false }
}
