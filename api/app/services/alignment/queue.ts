import { PgBoss } from 'pg-boss'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import aiConfig from '#config/ai'

/** pg-boss queues. "short": at most one queued job per key, so bursts collapse. */
export const QUEUES = {
  todo: 'alignment-todo',
  all: 'alignment-all',
  suggest: 'goal-suggestions',
} as const

export interface AlignmentQueue {
  /** Check one to-do in ~1.5 s (repeat requests while queued are merged). */
  checkTodo(todoId: number): Promise<void>
  /** Re-check all open to-dos in ~5 s, after goals or projects change. */
  checkAll(): Promise<void>
  /** Build goal suggestions for one run (after a goal completes or the limit rises). */
  suggestGoals(runId: number): Promise<void>
  close(): Promise<void>
}

/** A pg-boss instance on the direct (unpooled) Neon connection. */
export function createBoss(max: number, role: 'api' | 'worker') {
  const boss = new PgBoss({
    connectionString: env.get('DATABASE_URL_DIRECT'),
    max,
    application_name: `focus-alignment-${role}`,
    // Only the worker runs pg-boss maintenance; the API just sends jobs.
    supervise: role === 'worker',
    schedule: false,
  })
  boss.on('error', (error) => logger.error({ err: error }, 'pg-boss error'))
  return boss
}

export async function ensureQueues(boss: PgBoss) {
  for (const name of Object.values(QUEUES)) {
    if (await boss.getQueue(name)) continue
    await boss.createQueue(name, {
      policy: 'short',
      // Model retries happen inside the job; this covers a worker crash.
      retryLimit: 1,
      expireInSeconds: 15 * 60,
    })
  }
}

const later = (ms: number) => new Date(Date.now() + ms)

/** Sends jobs from the API. It never runs them: the worker process does. */
class BossQueue implements AlignmentQueue {
  private ready: Promise<PgBoss> | null = null

  private boss() {
    this.ready ??= (async () => {
      const boss = createBoss(2, 'api')
      await boss.start()
      await ensureQueues(boss)
      return boss
    })().catch((error) => {
      this.ready = null // try again next time
      throw error
    })
    return this.ready
  }

  async checkTodo(todoId: number) {
    const boss = await this.boss()
    await boss.send(
      QUEUES.todo,
      { todoId },
      { singletonKey: String(todoId), startAfter: later(aiConfig.todoDelayMs) }
    )
  }

  async checkAll() {
    const boss = await this.boss()
    await boss.send(QUEUES.all, {}, { startAfter: later(aiConfig.contextDelayMs) })
  }

  async suggestGoals(runId: number) {
    const boss = await this.boss()
    await boss.send(QUEUES.suggest, { runId }, { singletonKey: String(runId) })
  }

  async close() {
    const ready = this.ready
    this.ready = null
    if (!ready) return
    const boss = await ready
    await boss.stop({ graceful: false })
  }
}

let queue: AlignmentQueue | null = null

export function alignmentQueue(): AlignmentQueue {
  queue ??= new BossQueue()
  return queue
}

/** Tests swap in a fake; pass null to go back to pg-boss. */
export function useAlignmentQueue(fake: AlignmentQueue | null) {
  queue = fake
}
