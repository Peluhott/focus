import type { HttpContext } from '@adonisjs/core/http'
import Goal from '#models/goal'
import SubGoal from '#models/sub_goal'
import { findInWs, findSubGoal } from '#services/scoped'
import { bottomPosition, inList, positionFor, wantsMove } from '#services/ordering'
import { createSubGoalValidator, updateSubGoalValidator } from '#validators/goal'

const siblingsOf = (goalId: number) => () => SubGoal.query().where('goal_id', goalId)

export default class SubGoalsController {
  /** GET /goals/:id/subgoals, in checklist order. */
  async index({ params, workspace }: HttpContext) {
    const goal = await findInWs(Goal, workspace, params.id)
    const rows = await siblingsOf(goal.id)().orderBy('position', 'asc').orderBy('id', 'asc')
    return { data: rows.map((s) => s.serialize()), next_cursor: null }
  }

  /** POST /goals/:id/subgoals: appended to the bottom. No limit on sub-goals. */
  async store({ params, request, response, workspace }: HttpContext) {
    const goal = await findInWs(Goal, workspace, params.id)
    const input = await request.validateUsing(createSubGoalValidator)
    const sub = await inList(`subgoals:${goal.id}`, async (trx) =>
      SubGoal.create(
        {
          goalId: goal.id,
          title: input.title,
          details: '',
          done: false,
          position: await bottomPosition(siblingsOf(goal.id), trx),
        },
        { client: trx }
      )
    )
    await sub.refresh()
    return response.created(sub.serialize())
  }

  async update({ params, request, workspace }: HttpContext) {
    const sub = await findSubGoal(workspace, params.id)
    const input = await request.validateUsing(updateSubGoalValidator)
    if (input.title !== undefined) sub.title = input.title
    if (input.done !== undefined) sub.done = input.done
    if (wantsMove(input)) {
      await inList(`subgoals:${sub.goalId}`, async (trx) => {
        sub.position = await positionFor(siblingsOf(sub.goalId), input, sub.id, trx)
        await sub.useTransaction(trx).save()
      })
    } else {
      await sub.save()
    }
    return sub.serialize()
  }

  async destroy({ params, response, workspace }: HttpContext) {
    const sub = await findSubGoal(workspace, params.id)
    await sub.delete()
    return response.noContent()
  }
}
