import type { HttpContext } from '@adonisjs/core/http'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { DateTime } from 'luxon'
import Goal from '#models/goal'
import type Workspace from '#models/workspace'
import { assertCanActivate } from '#services/goal_limit'
import { findInWs, inWs } from '#services/scoped'
import { bottomPosition, inList, positionFor, wantsMove } from '#services/ordering'
import { startSuggestionRun } from '#services/suggestions/triggers'
import { paginateByPosition } from '#services/paginate'
import { createGoalValidator, listGoalsValidator, updateGoalValidator } from '#validators/goal'

/** A workspace's active goals, the list that drag-and-drop orders and the limit counts. */
export const activeGoalsOf = (ws: Workspace) => () => inWs(Goal, ws).where('status', 'active')

/** The advisory-lock key for a workspace's goal order. */
export const goalsList = (ws: Workspace) => `goals:${ws.id}`

/** Goals with their sub-goals (ordered) and linked-project count. */
function withDetails(query: ModelQueryBuilderContract<typeof Goal>) {
  return query
    .preload('subGoals', (q) => q.orderBy('position', 'asc').orderBy('id', 'asc'))
    .withCount('projects')
}

export function viewGoal(goal: Goal) {
  const subGoals = goal.subGoals ?? []
  return {
    ...goal.serialize(),
    sub_goals: subGoals.map((s) => s.serialize()),
    sub_goals_done: subGoals.filter((s) => s.done).length,
    sub_goals_total: subGoals.length,
    projects_count: Number(goal.$extras.projects_count ?? 0),
  }
}

export async function loadGoal(ws: Workspace, id: number | string) {
  return withDetails(inWs(Goal, ws).where('goals.id', id)).firstOrFail()
}

export default class GoalsController {
  /** GET /goals?status=active|completed|archived|all (default all). */
  async index({ request, workspace }: HttpContext) {
    const filters = await listGoalsValidator.validate(request.qs())
    const query = withDetails(inWs(Goal, workspace))
    if (filters.status && filters.status !== 'all') query.where('goals.status', filters.status)
    const { rows, nextCursor } = await paginateByPosition<Goal>(query, filters, 'goals')
    return { data: rows.map(viewGoal), next_cursor: nextCursor }
  }

  async show({ params, workspace }: HttpContext) {
    return viewGoal(await loadGoal(workspace, params.id))
  }

  /** POST /goals: a new active goal at the bottom, if under the limit (else 409). */
  async store({ request, response, workspace }: HttpContext) {
    const input = await request.validateUsing(createGoalValidator)
    const goal = await inList(goalsList(workspace), async (trx) => {
      await assertCanActivate(workspace.id, trx)
      return Goal.create(
        {
          workspaceId: workspace.id,
          title: input.title,
          details: '',
          status: 'active',
          position: await bottomPosition(activeGoalsOf(workspace), trx),
        },
        { client: trx }
      )
    })
    return response.created(viewGoal(await loadGoal(workspace, goal.id)))
  }

  /** PATCH /goals/:id: title or position (status has its own routes). */
  async update({ params, request, workspace }: HttpContext) {
    const goal = await findInWs(Goal, workspace, params.id)
    const input = await request.validateUsing(updateGoalValidator)
    if (input.title !== undefined) goal.title = input.title
    if (wantsMove(input)) {
      await inList(goalsList(workspace), async (trx) => {
        goal.position = await positionFor(activeGoalsOf(workspace), input, goal.id, trx)
        await goal.useTransaction(trx).save()
      })
    } else {
      await goal.save()
    }
    return viewGoal(await loadGoal(workspace, goal.id))
  }

  /**
   * POST /goals/:id/complete. The goal is completed first; then, with the AI
   * on, a goal-suggestion run is queued. suggestion_run_id is null when
   * nothing was queued (AI off, or too few backlog items).
   */
  async complete({ params, workspace }: HttpContext) {
    const goal = await findInWs(Goal, workspace, params.id)
    const wasActive = goal.status === 'active'
    goal.status = 'completed'
    goal.completedAt = DateTime.now()
    await goal.save()
    const suggestionRunId = wasActive
      ? await startSuggestionRun(workspace.id, 'goal_completed', goal.id)
      : null
    return { ...viewGoal(await loadGoal(workspace, goal.id)), suggestion_run_id: suggestionRunId }
  }

  async archive({ params, workspace }: HttpContext) {
    const goal = await findInWs(Goal, workspace, params.id)
    goal.status = 'archived'
    goal.completedAt = null
    await goal.save()
    return viewGoal(await loadGoal(workspace, goal.id))
  }

  /** POST /goals/:id/restore: back to active at the bottom, same limit check. */
  async restore({ params, workspace }: HttpContext) {
    await inList(goalsList(workspace), async (trx) => {
      const goal = await findInWs(Goal, workspace, params.id, trx)
      if (goal.status === 'active') return
      await assertCanActivate(workspace.id, trx)
      goal.status = 'active'
      goal.completedAt = null
      goal.position = await bottomPosition(activeGoalsOf(workspace), trx)
      await goal.save()
    })
    return viewGoal(await loadGoal(workspace, params.id))
  }

  /** DELETE /goals/:id: sub-goals go with it; linked projects keep going, unlinked. */
  async destroy({ params, response, workspace }: HttpContext) {
    const goal = await findInWs(Goal, workspace, params.id)
    await goal.delete()
    return response.noContent()
  }
}
