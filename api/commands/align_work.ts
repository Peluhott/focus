import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import type { Job } from 'pg-boss'
import aiConfig from '#config/ai'
import type { FileDeleteJob } from '#services/alignment/queue'

/**
 * The AI alignment worker: a separate process from the API (spec "Separate
 * process"). If it stops, the app keeps working and queued checks wait.
 *
 *   node ace align:work
 */
export default class AlignWork extends BaseCommand {
  static commandName = 'align:work'
  static description =
    'Run the background worker: AI alignment checks, goal suggestions, to-do hints, and Cloudinary file deletions'
  static options: CommandOptions = { startApp: true, staysAlive: true }

  async run() {
    const { aiConfigured } = await import('#services/alignment/triggers')
    const { storageConfigured } = await import('#config/storage')
    const ai = aiConfigured()
    const storage = storageConfigured()
    if (!ai && !storage) {
      this.logger.info(
        'AI check and file storage are both off (set AI_ENABLED=true and GEMINI_API_KEY, or the CLOUDINARY_* vars). Worker not started.'
      )
      await this.terminate()
      return
    }
    const { createBoss, ensureQueues, QUEUES } = await import('#services/alignment/queue')

    const boss = createBoss(4, 'worker')
    await boss.start()
    await ensureQueues(boss)

    if (ai) {
      const { AlignmentChecker } = await import('#services/alignment/checker')
      const { GeminiProvider } = await import('#services/alignment/gemini')
      const { AlignmentGuard } = await import('#services/alignment/guard')
      const { GoalSuggester } = await import('#services/suggestions/suggester')
      const { TodoHinter } = await import('#services/hints/hinter')
      // One breaker and spend cap for every model call this worker makes.
      const guard = new AlignmentGuard()
      const checker = new AlignmentChecker(new GeminiProvider(aiConfig.apiKey!), guard)
      const suggester = new GoalSuggester(aiConfig.apiKey!, guard)
      const hinter = new TodoHinter(aiConfig.apiKey!, guard)

      await boss.work<{ todoId: number }>(
        QUEUES.todo,
        { localConcurrency: 2, pollingIntervalSeconds: 2 },
        async ([job]: Job<{ todoId: number }>[]) => {
          const result = await checker.checkTodo(job.data.todoId)
          this.logger.info(`to-do ${job.data.todoId}: ${result}`)
        }
      )
      const { default: db } = await import('@adonisjs/lucid/services/db')
      /** Workspaces whose AI is on: the only ones whose content may be sent. */
      const aiWorkspaces = async () => {
        const rows: { id: number }[] = await db
          .from('workspaces')
          .where('ai_enabled', true)
          .select('id')
        return rows.map((r) => r.id)
      }
      await boss.work<{ workspaceId?: number }>(
        QUEUES.all,
        { pollingIntervalSeconds: 2 },
        async ([job]: Job<{ workspaceId?: number }>[]) => {
          // Jobs queued before workspaces existed have no id: run every AI-on workspace.
          const ids = job.data.workspaceId ? [job.data.workspaceId] : await aiWorkspaces()
          for (const id of ids) {
            const counts = await checker.checkAll(id)
            this.logger.info(`re-checked workspace ${id}: ${JSON.stringify(counts)}`)
          }
        }
      )
      await boss.work<{ runId: number }>(
        QUEUES.suggest,
        { pollingIntervalSeconds: 2 },
        async ([job]: Job<{ runId: number }>[]) => {
          const status = await suggester.run(job.data.runId)
          this.logger.info(`goal suggestions run ${job.data.runId}: ${status}`)
        }
      )
      await boss.work<{ runId: number }>(
        QUEUES.hint,
        { localConcurrency: 2, pollingIntervalSeconds: 1 },
        async ([job]: Job<{ runId: number }>[]) => {
          const status = await hinter.run(job.data.runId)
          this.logger.info(`to-do hint run ${job.data.runId}: ${status}`)
        }
      )
      // Re-check open to-dos on start, so a new model, prompt or context shape
      // applies to existing results. Unchanged ones hit the cache.
      for (const workspaceId of await aiWorkspaces()) {
        await boss.send(QUEUES.all, { workspaceId }, { singletonKey: String(workspaceId) })
      }
      this.logger.info(`Alignment worker running on ${aiConfig.model}`)
    }

    if (storage) {
      const { destroyAsset } = await import('#services/storage/cloudinary')
      // Throwing fails the job, and pg-boss retries it with backoff.
      await boss.work<FileDeleteJob>(
        QUEUES.fileDelete,
        { pollingIntervalSeconds: 5 },
        async ([job]: Job<FileDeleteJob>[]) => {
          const result = await destroyAsset(job.data.publicId, job.data.resourceType)
          this.logger.info(`deleted file ${job.data.publicId}: ${result}`)
        }
      )
      this.logger.info('File deletion worker running')
    }

    const stop = async () => {
      await boss.stop({ graceful: true, timeout: 10_000 })
      await this.terminate()
    }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  }
}
