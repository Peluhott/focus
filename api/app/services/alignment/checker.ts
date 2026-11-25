import { setTimeout as sleep } from 'node:timers/promises'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import aiConfig from '#config/ai'
import AlignmentCheck from '#models/alignment_check'
import Todo from '#models/todo'
import { setMatches } from '#services/matches'
import { buildContext, isEmpty, sha256, todoInput } from './context.js'
import { PROMPT_VERSION } from './gemini.js'
import { AlignmentGuard } from './guard.js'
import { aiActive } from './triggers.js'
import { NOTHING_ACTIVE, toOutcome, type Outcome } from './verdict.js'
import {
  ProviderError,
  type AlignmentContext,
  type AlignmentProvider,
  type ProviderResult,
} from './types.js'

export type CheckResult = 'skipped' | 'cached' | 'checked' | 'failed' | 'paused'

/** Whether the AI may set this to-do's alignment at all. */
const eligible = (todo: Todo) =>
  !todo.done && todo.alignmentSource !== 'manual' && todo.alignmentStatus !== 'dismissed'

/**
 * Runs alignment checks inside the worker: builds the context, reuses cached
 * verdicts, calls the provider with retries, logs every call and writes the
 * result back. Saving a to-do never waits on any of this.
 */
export class AlignmentChecker {
  constructor(
    private provider: AlignmentProvider,
    private guard = new AlignmentGuard(),
    private retryDelaysMs = aiConfig.retryDelaysMs
  ) {}

  async checkTodo(todoId: number, context?: AlignmentContext): Promise<CheckResult> {
    const todo = await Todo.find(todoId)
    if (!todo || !eligible(todo) || !(await aiActive(todo.workspaceId))) return 'skipped'

    context ??= await buildContext(todo.workspaceId)
    const input = todoInput(todo)
    const inputHash = sha256([this.provider.model, PROMPT_VERSION, input, context.version])

    if (isEmpty(context)) {
      await this.write(todo, NOTHING_ACTIVE)
      return 'cached'
    }

    const cached = await AlignmentCheck.query()
      .where('workspace_id', todo.workspaceId)
      .where('input_hash', inputHash)
      .whereNotNull('verdict')
      .orderBy('id', 'desc')
      .first()
    if (cached?.verdict) {
      await this.write(todo, toOutcome(cached.verdict, context))
      return 'cached'
    }

    const blocked = await this.guard.blocked(todo.workspaceId)
    if (blocked) {
      // Leave earlier verdicts alone; only a to-do waiting on this check
      // turns neutral ("error"), so it doesn't spin forever.
      if (todo.alignmentStatus === 'pending') await this.writeError(todo, blocked)
      return 'paused'
    }

    const result = await this.call(todo, input, context, inputHash)
    if (!result) {
      await this.writeError(todo, 'The AI check failed. Try again later.')
      return 'failed'
    }
    await this.write(todo, toOutcome(result.verdict, context))
    return 'checked'
  }

  /**
   * Re-check every open to-do in one workspace the AI may judge, against one fresh context
   * (after a goal, sub-goal, project or task changes). Unchanged items hit
   * the cache, so this is cheap when nothing relevant moved.
   */
  async checkAll(workspaceId: number): Promise<Record<CheckResult, number>> {
    const counts: Record<CheckResult, number> = {
      skipped: 0,
      cached: 0,
      checked: 0,
      failed: 0,
      paused: 0,
    }
    if (!(await aiActive(workspaceId))) return counts
    const context = await buildContext(workspaceId)
    const todos = await Todo.query()
      .where('workspace_id', workspaceId)
      .where('done', false)
      .where((q) => q.whereNull('alignment_source').orWhere('alignment_source', 'ai'))
      .where((q) => q.whereNull('alignment_status').orWhereNot('alignment_status', 'dismissed'))
      .orderBy('position')
      .select('id')
    for (const { id } of todos) {
      const result = await this.checkTodo(id, context)
      counts[result]++
      if (result === 'paused') break
    }
    return counts
  }

  /** One model call with up to two retries; every attempt is logged. */
  private async call(
    todo: Todo,
    input: { title: string; notes: string },
    context: AlignmentContext,
    inputHash: string
  ): Promise<ProviderResult | null> {
    const attempts = this.retryDelaysMs.length + 1
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const result = await this.provider.classifyAlignment(input, context)
        this.guard.succeeded()
        await this.log(todo, context, inputHash, result.verdict, result)
        return result
      } catch (error) {
        this.guard.failed()
        const failure = error instanceof ProviderError ? error : null
        await this.log(todo, context, null, null, {
          usage: failure?.usage ?? { inputTokens: 0, outputTokens: 0 },
          latencyMs: failure?.latencyMs ?? 0,
        })
        logger.warn(
          { todoId: todo.id, attempt, err: (error as Error).message },
          'alignment check attempt failed'
        )
        if (this.guard.tripped) break
        if (attempt < attempts) await sleep(this.retryDelaysMs[attempt - 1])
      }
    }
    return null
  }

  private async log(
    todo: Todo,
    context: AlignmentContext,
    inputHash: string | null,
    verdict: ProviderResult['verdict'] | null,
    stats: Pick<ProviderResult, 'usage' | 'latencyMs'>
  ) {
    await AlignmentCheck.create({
      todoId: todo.id,
      workspaceId: todo.workspaceId,
      model: this.provider.model,
      contextVersion: context.version,
      inputHash,
      verdict,
      inputTokens: stats.usage.inputTokens,
      outputTokens: stats.usage.outputTokens,
      latencyMs: stats.latencyMs,
    })
  }

  /**
   * Write the outcome unless the to-do changed while the model was thinking:
   * new text (a newer check is queued), done, dismissed or linked by hand.
   */
  private async write(checked: Todo, outcome: Outcome) {
    await this.update(
      checked,
      { alignmentStatus: outcome.status, alignmentReason: outcome.reason, alignmentSource: 'ai' },
      outcome.goals
    )
  }

  private async writeError(checked: Todo, reason: string) {
    await this.update(
      checked,
      { alignmentStatus: 'error', alignmentReason: reason, alignmentSource: null },
      []
    )
  }

  private async update(checked: Todo, fields: Partial<Todo>, goals: Outcome['goals']) {
    await db.transaction(async (trx) => {
      const todo = await Todo.query({ client: trx }).where('id', checked.id).forUpdate().first()
      if (!todo || !eligible(todo)) return
      if (todo.title !== checked.title || todo.notes !== checked.notes) return
      todo.merge({ ...fields, checkedAt: DateTime.now() })
      await todo.save()
      await setMatches(todo.id, goals, trx)
    })
  }
}
