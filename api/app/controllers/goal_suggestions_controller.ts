import type { HttpContext } from '@adonisjs/core/http'
import AppError from '#exceptions/app_error'
import Goal from '#models/goal'
import GoalSuggestion from '#models/goal_suggestion'
import GoalSuggestionRun from '#models/goal_suggestion_run'
import OffTrackItem from '#models/off_track_item'
import SubGoal from '#models/sub_goal'
import { assertCanActivate } from '#services/goal_limit'
import { bottomPosition, inList } from '#services/ordering'
import { findInWs, inWs } from '#services/scoped'
import type Workspace from '#models/workspace'
import { acceptSuggestionValidator, listStatusValidator } from '#validators/suggestion'
import { activeGoalsOf, goalsList, loadGoal, viewGoal } from './goals_controller.js'

const listValidator = listStatusValidator(['open', 'accepted', 'dismissed'])

/** A suggestion with the backlog items it's based on ("Based on N items"). */
async function views(ws: Workspace, suggestions: GoalSuggestion[]) {
  const ids = [...new Set(suggestions.flatMap((s) => s.itemIds))]
  const items = ids.length ? await inWs(OffTrackItem, ws).whereIn('id', ids) : []
  const byId = new Map(items.map((i) => [i.id, i]))
  return suggestions.map((s) => ({
    ...s.serialize(),
    items: s.itemIds
      .map((id) => byId.get(id))
      .filter((i): i is OffTrackItem => !!i)
      .map((i) => ({
        id: i.id,
        title: i.titleSnapshot,
        reason: i.reason,
        moved_at: i.movedAt.toISO(),
        status: i.status,
      })),
  }))
}

export default class GoalSuggestionsController {
  /**
   * GET /goal-suggestions?status=open (default). Also returns the latest run,
   * so the page can wait for one that's queued and tell "no themes" from
   * "failed".
   */
  async index({ request, workspace }: HttpContext) {
    const { status = 'open' } = await listValidator.validate(request.qs())
    const query = inWs(GoalSuggestion, workspace).orderBy('id', 'asc')
    if (status !== 'all') query.where('status', status)
    const latest = await inWs(GoalSuggestionRun, workspace).orderBy('id', 'desc').first()
    return {
      data: await views(workspace, await query),
      latest_run: latest
        ? {
            id: latest.id,
            status: latest.status,
            trigger: latest.trigger,
            created_at: latest.createdAt.toISO(),
          }
        : null,
    }
  }

  /**
   * POST /goal-suggestions/:id/accept, with optional edits. Creates an active
   * goal (at the bottom, within the focus limit) with the proposed sub-goals,
   * and marks the backlog items it used. 409 goal_limit_reached if the spot
   * has been filled since.
   */
  async accept({ params, request, response, workspace }: HttpContext) {
    const input = await request.validateUsing(acceptSuggestionValidator)
    const goalId = await inList(goalsList(workspace), async (trx) => {
      const suggestion = await inWs(GoalSuggestion, workspace, trx)
        .where('id', params.id)
        .forUpdate()
        .first()
      if (!suggestion) throw AppError.notFound('Suggestion')
      if (suggestion.status !== 'open')
        throw AppError.validation('This suggestion was already decided.')
      await assertCanActivate(workspace.id, trx)

      const goal = await Goal.create(
        {
          workspaceId: workspace.id,
          title: input.title ?? suggestion.title,
          // Goals have no details any more; the suggestion's "why" stays on the suggestion.
          details: '',
          status: 'active',
          position: await bottomPosition(activeGoalsOf(workspace), trx),
        },
        { client: trx }
      )
      const titles = (input.sub_goals ?? suggestion.subGoals).filter((t) => t.trim())
      for (const title of titles) {
        await SubGoal.create(
          {
            goalId: goal.id,
            title: title.trim(),
            details: '',
            done: false,
            position: await bottomPosition(() => SubGoal.query().where('goal_id', goal.id), trx),
          },
          { client: trx }
        )
      }

      suggestion.useTransaction(trx)
      suggestion.merge({ status: 'accepted', acceptedGoalId: goal.id })
      await suggestion.save()
      if (suggestion.itemIds.length) {
        await inWs(OffTrackItem, workspace, trx)
          .whereIn('id', suggestion.itemIds)
          .where('status', 'open')
          .update({ status: 'used', used_in_goal_id: goal.id })
      }
      return goal.id
    })
    return response.created(viewGoal(await loadGoal(workspace, goalId)))
  }

  /** POST /goal-suggestions/:id/dismiss: the card goes; its items stay open. */
  async dismiss({ params, workspace }: HttpContext) {
    const suggestion = await findInWs(GoalSuggestion, workspace, params.id)
    if (suggestion.status === 'open') {
      suggestion.status = 'dismissed'
      await suggestion.save()
    }
    const [view] = await views(workspace, [suggestion])
    return view
  }
}
