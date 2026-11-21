import type { HttpContext } from '@adonisjs/core/http'
import AppError from '#exceptions/app_error'
import Todo from '#models/todo'
import { aiConfigured, queueContextRecheck } from '#services/alignment/triggers'
import { activeGoalCount } from '#services/goal_limit'
import { updateSettingsValidator } from '#validators/settings'

/**
 * ai_enabled is the account's toggle; ai_available says whether the server
 * can run checks at all (AI_ENABLED and GEMINI_API_KEY). The check runs
 * only when both are true.
 */
const view = (user: { focusLimit: number; aiEnabled: boolean }) => ({
  focus_limit: user.focusLimit,
  ai_enabled: user.aiEnabled,
  ai_available: aiConfigured(),
})

export default class SettingsController {
  async show({ auth }: HttpContext) {
    return view(auth.getUserOrFail())
  }

  /**
   * PATCH /settings. Lowering focus_limit below the number of active goals
   * is refused: archive or complete goals first.
   */
  async update({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const input = await request.validateUsing(updateSettingsValidator)

    if (input.focus_limit !== undefined) {
      const active = await activeGoalCount()
      if (input.focus_limit < active) {
        const over = active - input.focus_limit
        throw AppError.validation(
          `Archive ${over} ${over === 1 ? 'goal' : 'goals'} to drop to ${input.focus_limit}.`
        )
      }
      user.focusLimit = input.focus_limit
    }
    const aiChanged = input.ai_enabled !== undefined && input.ai_enabled !== user.aiEnabled
    if (input.ai_enabled !== undefined) user.aiEnabled = input.ai_enabled
    await user.save()

    if (aiChanged && user.aiEnabled) {
      // Turned on: check every open to-do.
      await queueContextRecheck()
    } else if (aiChanged) {
      // Turned off: nothing waits on a check any more.
      await Todo.query().where('alignment_status', 'pending').update({ alignment_status: null })
    }
    return view(user)
  }
}
