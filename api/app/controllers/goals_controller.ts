import type { HttpContext } from '@adonisjs/core/http'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { DateTime } from 'luxon'
import Goal from '#models/goal'
import { assertCanActivate } from '#services/goal_limit'
import { bottomPosition, inList, positionFor, wantsMove } from '#services/ordering'
import { startSuggestionRun } from '#services/suggestions/triggers'
import { paginateByPosition } from '#services/paginate'
import { createGoalValidator, listGoalsValidator, updateGoalValidator } from '#validators/goal'

/** Active goals, the list that drag-and-drop orders and the limit counts. */
const activeGoals = () => Goal.query().where('status', 'active')

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

export async function loadGoal(id: number | string) {
  return withDetails(Goal.query().where('id', id)).firstOrFail()
}

export default class GoalsController {
  /** GET /goals?status=active|completed|archived|all (default all). */
  async index({ request }: HttpContext) {
    const filters = await listGoalsValidator.validate(request.qs())
    const query = withDetails(Goal.query())
    if (filters.status && filters.status !== 'all') query.where('goals.status', filters.status)
    const { rows, nextCursor } = await paginateByPosition<Goal>(query, filters, 'goals')
    return { data: rows.map(viewGoal), next_cursor: nextCursor }
  }

  async show({ params }: HttpContext) {
    return viewGoal(await loadGoal(params.id))
  }

  /** POST /goals: a new active goal at the bottom, if under the limit (else 409). */
  async store({ auth, request, response }: HttpContext) {
    const input = await request.validateUsing(createGoalValidator)
    const userId = auth.getUserOrFail().id
    const goal = await inList('goals', async (trx) => {
      await assertCanActivate(userId, trx)
      return Goal.create(
        {
          title: input.title,
          details: input.details ?? '',
          status: 'active',
          position: await bottomPosition(activeGoals, trx),
        },
        { client: trx }
      )
    })
    return response.created(viewGoal(await loadGoal(goal.id)))
  }

  /** PATCH /goals/:id: title, details or position (status has its own routes). */
  async update({ params, request }: HttpContext) {
    const goal = await Goal.findOrFail(params.id)
    const input = await request.validateUsing(updateGoalValidator)
    if (input.title !== undefined) goal.title = input.title
    if (input.details !== undefined) goal.details = input.details
    if (wantsMove(input)) {
      await inList('goals', async (trx) => {
        goal.position = await positionFor(activeGoals, input, goal.id, trx)
        await goal.useTransaction(trx).save()
      })
    } else {
      await goal.save()
    }
    return viewGoal(await loadGoal(goal.id))
  }

  /**
   * POST /goals/:id/complete. The goal is completed first; then, with the AI
   * on, a goal-suggestion run is queued. suggestion_run_id is null when
   * nothing was queued (AI off, or too few backlog items).
   */
  async complete({ params }: HttpContext) {
    const goal = await Goal.findOrFail(params.id)
    const wasActive = goal.status === 'active'
    goal.status = 'completed'
    goal.completedAt = DateTime.now()
    await goal.save()
    const suggestionRunId = wasActive ? await startSuggestionRun('goal_completed', goal.id) : null
    return { ...viewGoal(await loadGoal(goal.id)), suggestion_run_id: suggestionRunId }
  }

  async archive({ params }: HttpContext) {
    const goal = await Goal.findOrFail(params.id)
    goal.status = 'archived'
    goal.completedAt = null
    await goal.save()
    return viewGoal(await loadGoal(goal.id))
  }

  /** POST /goals/:id/restore: back to active at the bottom, same limit check. */
  async restore({ auth, params }: HttpContext) {
    const userId = auth.getUserOrFail().id
    await inList('goals', async (trx) => {
      const goal = await Goal.query({ client: trx }).where('id', params.id).firstOrFail()
      if (goal.status === 'active') return
      await assertCanActivate(userId, trx)
      goal.status = 'active'
      goal.completedAt = null
      goal.position = await bottomPosition(activeGoals, trx)
      await goal.save()
    })
    return viewGoal(await loadGoal(params.id))
  }

  /** DELETE /goals/:id: sub-goals go with it; linked projects keep going, unlinked. */
  async destroy({ params, response }: HttpContext) {
    const goal = await Goal.findOrFail(params.id)
    await goal.delete()
    return response.noContent()
  }
}
