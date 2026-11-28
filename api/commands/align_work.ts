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
    // The app logger (not this.logger, the CLI one) so job lines reach storage/logs.
    const { default: logger } = await import('@adonisjs/core/services/logger')
    /** Logs a job that throws, then rethrows so pg-boss still retries it. */
    const logged =
      <T extends object>(queue: string, handle: (job: Job<T>) => Promise<void>) =>
      async ([job]: Job<T>[]) => {
        try {
          await handle(job)
        } catch (err) {
          logger.error({ err, queue, jobId: job.id, data: job.data }, `job failed on ${queue}`)
          throw err
        }
      }

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
        logged<{ todoId: number }>(QUEUES.todo, async (job) => {
          const result = await checker.checkTodo(job.data.todoId)
          logger.info(`to-do ${job.data.todoId}: ${result}`)
        })
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
      const { quietRemainingMs } = await import('#services/alignment/triggers')
      const { alignmentVersion } = await import('#services/alignment/gemini')
      await boss.work<{ workspaceId?: number }>(
        QUEUES.all,
        { pollingIntervalSeconds: 2 },
        logged<{ workspaceId?: number }>(QUEUES.all, async (job) => {
          // Jobs queued before workspaces existed have no id: run every AI-on workspace.
          const ids = job.data.workspaceId ? [job.data.workspaceId] : await aiWorkspaces()
          for (const id of ids) {
            // Goals were edited again since this was queued: wait until the
            // edits have been quiet, so the session ends in one re-check.
            // (The queue keeps one waiting job per workspace; this one is
            // active, so the new one is accepted unless another is waiting.)
            const wait = await quietRemainingMs(id)
            if (wait > 0) {
              await boss.send(
                QUEUES.all,
                { workspaceId: id },
                { singletonKey: String(id), startAfter: new Date(Date.now() + wait) }
              )
              continue
            }
            const counts = await checker.checkAll(id)
            logger.info(`re-checked workspace ${id}: ${JSON.stringify(counts)}`)
            // Every to-do was graded with this model and prompt (unless the AI
            // paused part-way), so a restart needn't redo this workspace.
            if (counts.paused === 0 && counts.failed === 0) {
              await db
                .from('workspaces')
                .where('id', id)
                .update({ alignment_version: alignmentVersion() })
            }
          }
        })
      )
      await boss.work<{ runId: number }>(
        QUEUES.suggest,
        { pollingIntervalSeconds: 2 },
        logged<{ runId: number }>(QUEUES.suggest, async (job) => {
          const status = await suggester.run(job.data.runId)
          logger.info(`goal suggestions run ${job.data.runId}: ${status}`)
        })
      )
      await boss.work<{ runId: number }>(
        QUEUES.hint,
        { localConcurrency: 2, pollingIntervalSeconds: 1 },
        logged<{ runId: number }>(QUEUES.hint, async (job) => {
          const status = await hinter.run(job.data.runId)
          logger.info(`to-do hint run ${job.data.runId}: ${status}`)
        })
      )
      // A new model or prompt: re-grade existing results, but only in
      // workspaces whose last full re-check used something else, most
      // recently used first. The queue runs one workspace at a time.
      // Otherwise a restart (every deploy) makes no AI calls.
      const stale: { id: number }[] = await db
        .from('workspaces')
        .where('ai_enabled', true)
        .where((q) =>
          q.whereNull('alignment_version').orWhereNot('alignment_version', alignmentVersion())
        )
        .orderByRaw(
          '(SELECT max(updated_at) FROM todos WHERE todos.workspace_id = workspaces.id) DESC NULLS LAST'
        )
        .select('id')
      for (const { id: workspaceId } of stale) {
        await boss.send(QUEUES.all, { workspaceId }, { singletonKey: String(workspaceId) })
      }
      if (stale.length) logger.info(`re-checking ${stale.length} workspaces for ${alignmentVersion()}`)
      logger.info(`Alignment worker running on ${aiConfig.model}`)
    }

    if (storage) {
      const { destroyAsset } = await import('#services/storage/cloudinary')
      // Throwing fails the job, and pg-boss retries it with backoff.
      await boss.work<FileDeleteJob>(
        QUEUES.fileDelete,
        { pollingIntervalSeconds: 5 },
        logged<FileDeleteJob>(QUEUES.fileDelete, async (job) => {
          const result = await destroyAsset(job.data.publicId, job.data.resourceType)
          logger.info(`deleted file ${job.data.publicId}: ${result}`)
        })
      )
      logger.info('File deletion worker running')
    }

    const stop = async () => {
      await boss.stop({ graceful: true, timeout: 10_000 })
      await this.terminate()
    }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  }
}
