import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import type { Job } from 'pg-boss'
import aiConfig from '#config/ai'

/**
 * The AI alignment worker: a separate process from the API (spec "Separate
 * process"). If it stops, the app keeps working and queued checks wait.
 *
 *   node ace align:work
 */
export default class AlignWork extends BaseCommand {
  static commandName = 'align:work'
  static description =
    'Run the AI worker: alignment checks for to-dos, and goal suggestions from the off-track backlog'
  static options: CommandOptions = { startApp: true, staysAlive: true }

  async run() {
    const { aiConfigured } = await import('#services/alignment/triggers')
    if (!aiConfigured()) {
      this.logger.info(
        'AI check is off (set AI_ENABLED=true and GEMINI_API_KEY). Worker not started.'
      )
      await this.terminate()
      return
    }
    const { createBoss, ensureQueues, QUEUES } = await import('#services/alignment/queue')
    const { AlignmentChecker } = await import('#services/alignment/checker')
    const { GeminiProvider } = await import('#services/alignment/gemini')
    const { AlignmentGuard } = await import('#services/alignment/guard')
    const { GoalSuggester } = await import('#services/suggestions/suggester')

    const boss = createBoss(4, 'worker')
    await boss.start()
    await ensureQueues(boss)
    // One breaker and spend cap for every model call this worker makes.
    const guard = new AlignmentGuard()
    const checker = new AlignmentChecker(new GeminiProvider(aiConfig.apiKey!), guard)
    const suggester = new GoalSuggester(aiConfig.apiKey!, guard)

    await boss.work<{ todoId: number }>(
      QUEUES.todo,
      { localConcurrency: 2, pollingIntervalSeconds: 2 },
      async ([job]: Job<{ todoId: number }>[]) => {
        const result = await checker.checkTodo(job.data.todoId)
        this.logger.info(`to-do ${job.data.todoId}: ${result}`)
      }
    )
    await boss.work(QUEUES.all, { pollingIntervalSeconds: 2 }, async () => {
      const counts = await checker.checkAll()
      this.logger.info(`re-checked open to-dos: ${JSON.stringify(counts)}`)
    })
    await boss.work<{ runId: number }>(
      QUEUES.suggest,
      { pollingIntervalSeconds: 2 },
      async ([job]: Job<{ runId: number }>[]) => {
        const status = await suggester.run(job.data.runId)
        this.logger.info(`goal suggestions run ${job.data.runId}: ${status}`)
      }
    )
    // Re-check open to-dos on start, so a new model, prompt or context shape
    // applies to existing results. Unchanged ones hit the cache.
    await boss.send(QUEUES.all, {})
    this.logger.info(`Alignment worker running on ${aiConfig.model}`)

    const stop = async () => {
      await boss.stop({ graceful: true, timeout: 10_000 })
      await this.terminate()
    }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  }
}
