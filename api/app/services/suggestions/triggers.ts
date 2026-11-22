import logger from '@adonisjs/core/services/logger'
import GoalSuggestion from '#models/goal_suggestion'
import GoalSuggestionRun, { type SuggestionTrigger } from '#models/goal_suggestion_run'
import OffTrackItem from '#models/off_track_item'
import { aiActive } from '#services/alignment/triggers'
import { alignmentQueue } from '#services/alignment/queue'

/** Fewer open backlog items than this and there's no theme to find. */
export const MIN_ITEMS = 3

export async function openBacklogCount() {
  const row = await OffTrackItem.query().where('status', 'open').count('* as total').first()
  return Number(row?.$extras.total ?? 0)
}

/**
 * A goal was completed or the focus limit went up: queue a suggestion run.
 * Called after the change is saved, and never throws, so completing a goal
 * works the same with the AI on, off or failing. Returns the run id, or
 * null when nothing was queued.
 */
export async function startSuggestionRun(
  trigger: SuggestionTrigger,
  triggerGoalId: number | null = null
): Promise<number | null> {
  let run: GoalSuggestionRun | null = null
  try {
    if (!(await aiActive())) return null
    const itemCount = await openBacklogCount()
    if (itemCount < MIN_ITEMS) {
      await GoalSuggestionRun.create({ trigger, triggerGoalId, status: 'skipped', itemCount })
      return null
    }
    // One set of suggestions at a time: undecided ones from earlier runs go.
    await GoalSuggestion.query().where('status', 'open').update({ status: 'dismissed' })
    run = await GoalSuggestionRun.create({ trigger, triggerGoalId, status: 'queued', itemCount })
    await alignmentQueue().suggestGoals(run.id)
    return run.id
  } catch (error) {
    logger.error({ err: error, trigger }, 'could not queue goal suggestions')
    if (run) {
      run.merge({ status: 'error', error: "Couldn't start the suggestion run." })
      await run.save().catch(() => {})
    }
    return null
  }
}
