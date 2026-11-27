import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import aiConfig from '#config/ai'
import AlignmentCheck from '#models/alignment_check'
import Todo from '#models/todo'
import { setMatches } from '#services/matches'
import { callModel, type Attempt } from './call.js'
import { buildContext, isEmpty, sha256, todoInput } from './context.js'
import { PROMPT_VERSION } from './gemini.js'
import { AlignmentGuard } from './guard.js'
import { alignmentQueue } from './queue.js'
import { aiActive } from './triggers.js'
import { NOTHING_ACTIVE, toOutcome, type Outcome } from './verdict.js'
import type { AlignmentContext, AlignmentProvider, Usage, Verdict } from './types.js'

export type CheckResult = 'skipped' | 'cached' | 'checked' | 'failed' | 'paused'

const FAILED = 'The AI check failed. Try again later.'

/** Whether the AI may set this to-do's alignment at all. */
const eligible = (todo: Todo) =>
  !todo.done && todo.alignmentSource !== 'manual' && todo.alignmentStatus !== 'dismissed'

type Links = Map<number, { id: number; confidence: number | null }[]>

/** The to-do already shows this outcome: nothing to write. */
function unchanged(todo: Todo, outcome: Outcome, links: Links) {
  if (todo.alignmentStatus !== outcome.status) return false
  if (todo.alignmentReason !== outcome.reason || todo.alignmentSource !== 'ai') return false
  const current = links.get(todo.id) ?? []
  if (current.length !== outcome.goals.length) return false
  return outcome.goals.every((g) =>
    current.some((c) => c.id === g.id && Number(c.confidence) === Number(g.confidence))
  )
}

/**
 * Runs alignment checks inside the worker: builds the context, reuses cached
 * verdicts, calls the provider (several to-dos per call on a re-check),
 * logs every verdict and writes the result back. Saving a to-do never
 * waits on any of this.
 */
export class AlignmentChecker {
  constructor(
    private provider: AlignmentProvider,
    private guard = new AlignmentGuard(),
    private retryDelaysMs = aiConfig.retryDelaysMs
  ) {}

  private hashFor(todo: Todo, context: AlignmentContext) {
    return sha256([this.provider.model, PROMPT_VERSION, todoInput(todo), context.version])
  }

  async checkTodo(todoId: number, context?: AlignmentContext): Promise<CheckResult> {
    const todo = await Todo.find(todoId)
    if (!todo || !eligible(todo) || !(await aiActive(todo.workspaceId))) return 'skipped'

    context ??= await buildContext(todo.workspaceId)
    if (isEmpty(context)) {
      await this.write(todo, NOTHING_ACTIVE)
      return 'cached'
    }

    const inputHash = this.hashFor(todo, context)
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
      await this.resumeAfterPause(todo.workspaceId)
      return 'paused'
    }

    const { verdicts, paused } = await this.callBatch(todo.workspaceId, [todo], context)
    const verdict = verdicts.get(todo.id)
    if (!verdict) {
      await this.writeError(todo, FAILED)
      if (paused) await this.resumeAfterPause(todo.workspaceId)
      return 'failed'
    }
    await this.write(todo, toOutcome(verdict, context))
    return 'checked'
  }

  /**
   * Re-check every open to-do in one workspace the AI may judge, against one
   * fresh context (after a goal, sub-goal or project changes). Cached
   * verdicts come from one query, to-dos whose result didn't change aren't
   * written, and the rest go to the model `batchSize` at a time, so the
   * goals are sent once per batch instead of once per to-do.
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
    if (todos.length === 0) return counts
    const links = await this.linksOf(todos)

    if (isEmpty(context)) {
      for (const todo of todos) {
        if (!unchanged(todo, NOTHING_ACTIVE, links)) await this.write(todo, NOTHING_ACTIVE)
        counts.cached++
      }
      return counts
    }

    const hashes = new Map(todos.map((t) => [t.id, this.hashFor(t, context)]))
    const cachedRows = await AlignmentCheck.query()
      .where('workspace_id', workspaceId)
      .whereIn('input_hash', [...new Set(hashes.values())])
      .whereNotNull('verdict')
      .orderBy('id', 'desc')
      .select('input_hash', 'verdict')
    const cache = new Map<string, Verdict>()
    for (const row of cachedRows) {
      if (row.inputHash && row.verdict && !cache.has(row.inputHash)) {
        cache.set(row.inputHash, row.verdict)
      }
    }

    const misses: Todo[] = []
    for (const todo of todos) {
      const verdict = cache.get(hashes.get(todo.id)!)
      if (!verdict) {
        misses.push(todo)
        continue
      }
      const outcome = toOutcome(verdict, context)
      if (!unchanged(todo, outcome, links)) await this.write(todo, outcome)
      counts.cached++
    }

    for (let i = 0; i < misses.length; i += aiConfig.batchSize) {
      const chunk = misses.slice(i, i + aiConfig.batchSize)
      const blocked = await this.guard.blocked(workspaceId)
      if (blocked) {
        for (const todo of misses.slice(i)) {
          if (todo.alignmentStatus === 'pending') await this.writeError(todo, blocked)
        }
        counts.paused += misses.length - i
        await this.resumeAfterPause(workspaceId)
        break
      }
      const { verdicts, paused } = await this.callBatch(workspaceId, chunk, context)
      for (const todo of chunk) {
        const verdict = verdicts.get(todo.id)
        if (verdict) {
          await this.write(todo, toOutcome(verdict, context))
          counts.checked++
        } else {
          await this.writeError(todo, FAILED)
          counts.failed++
        }
      }
      if (paused) {
        counts.paused += misses.length - i - chunk.length
        await this.resumeAfterPause(workspaceId)
        break
      }
    }
    return counts
  }

  /**
   * One model call for these to-dos (with retries, billed to the ledger).
   * Returns verdicts by to-do id; a to-do the model skipped is missing.
   * Each verdict is logged in alignment_checks (the cache).
   */
  private async callBatch(workspaceId: number, todos: Todo[], context: AlignmentContext) {
    const items = todos.map((todo, i) => ({ key: `t${i + 1}`, input: todoInput(todo) }))
    const outcome = await callModel({
      guard: this.guard,
      workspaceId,
      kind: 'alignment',
      model: this.provider.model,
      retryDelaysMs: this.retryDelaysMs,
      // The check runs at temperature 0: the same input gives the same bad answer.
      contentRetries: 0,
      attempt: () => this.classify(items, context),
      log: { workspaceId, todoIds: todos.map((t) => t.id) },
    })

    const verdicts = new Map<number, Verdict>()
    if (outcome.value) {
      items.forEach((item, i) => {
        const verdict = outcome.value!.get(item.key)
        if (verdict) verdicts.set(todos[i].id, verdict)
      })
      await this.log(todos, verdicts, context, outcome.usage, outcome.latencyMs)
    }
    return { verdicts, paused: outcome.paused }
  }

  /** The provider's batch call, or one call per to-do for providers without one. */
  private async classify(
    items: { key: string; input: { title: string; notes: string } }[],
    context: AlignmentContext
  ): Promise<Attempt<Map<string, Verdict>>> {
    if (this.provider.classifyBatch) {
      const result = await this.provider.classifyBatch(items, context)
      return { value: result.verdicts, usage: result.usage, latencyMs: result.latencyMs }
    }
    const value = new Map<string, Verdict>()
    const usage: Usage = { inputTokens: 0, outputTokens: 0 }
    let latencyMs = 0
    for (const item of items) {
      const result = await this.provider.classifyAlignment(item.input, context)
      value.set(item.key, result.verdict)
      usage.inputTokens += result.usage.inputTokens
      usage.outputTokens += result.usage.outputTokens
      latencyMs += result.latencyMs
    }
    return { value, usage, latencyMs }
  }

  /** One alignment_checks row per verdict; the call's tokens are split across them. */
  private async log(
    todos: Todo[],
    verdicts: Map<number, Verdict>,
    context: AlignmentContext,
    usage: Usage,
    latencyMs: number
  ) {
    const n = Math.max(1, verdicts.size)
    const rows = todos
      .filter((t) => verdicts.has(t.id))
      .map((todo) => ({
        todoId: todo.id,
        workspaceId: todo.workspaceId,
        model: this.provider.model,
        contextVersion: context.version,
        inputHash: this.hashFor(todo, context),
        verdict: verdicts.get(todo.id)!,
        inputTokens: Math.round(usage.inputTokens / n),
        outputTokens: Math.round(usage.outputTokens / n),
        latencyMs,
      }))
    if (rows.length) await AlignmentCheck.createMany(rows)
  }

  /** Current goal links of these to-dos, in one query. */
  private async linksOf(todos: Todo[]): Promise<Links> {
    const rows: { todo_id: number; target_id: number; confidence: number | null }[] = await db
      .from('todo_matches')
      .whereIn(
        'todo_id',
        todos.map((t) => t.id)
      )
      .where('target_type', 'goal')
      .select('todo_id', 'target_id', 'confidence')
    const links: Links = new Map()
    for (const row of rows) {
      const list = links.get(row.todo_id) ?? []
      list.push({ id: row.target_id, confidence: row.confidence })
      links.set(row.todo_id, list)
    }
    return links
  }

  /**
   * The circuit breaker is open: re-check this workspace once it closes, so
   * to-dos left at "error" by the pause get their verdict without an edit.
   * (Budget pauses aren't retried: they last until next month.)
   */
  private async resumeAfterPause(workspaceId: number) {
    if (!this.guard.tripped) return
    try {
      await alignmentQueue().checkAll(workspaceId, this.guard.resumesInMs + 5_000)
    } catch (error) {
      logger.error({ err: error, workspaceId }, 'could not queue a re-check after the AI pause')
    }
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
