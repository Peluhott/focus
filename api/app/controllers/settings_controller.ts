import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import AppError from '#exceptions/app_error'
import type User from '#models/user'
import Workspace from '#models/workspace'
import { storageConfigured } from '#config/storage'
import { aiConfigured, queueContextRecheck } from '#services/alignment/triggers'
import { activeGoalCount } from '#services/goal_limit'
import { inWs } from '#services/scoped'
import { startSuggestionRun } from '#services/suggestions/triggers'
import Todo from '#models/todo'
import { updateSettingsValidator } from '#validators/settings'

/**
 * Settings for the request's workspace (X-Focus-Workspace). focus_limit,
 * timer_minutes and last_workspace_id are the user's and shared by every
 * workspace; ai_enabled is this workspace's toggle (off by default except
 * in Personal). ai_available says whether the server can run checks at all
 * (AI_ENABLED and GEMINI_API_KEY): the check runs only when both are true.
 * storage_enabled says whether uploads (files, feedback screenshots) work.
 */
const view = (user: User, workspace: Workspace) => ({
  focus_limit: user.focusLimit,
  timer_minutes: user.timerMinutes,
  last_workspace_id: user.lastWorkspaceId,
  workspace: { id: workspace.id, name: workspace.displayName },
  ai_enabled: workspace.aiEnabled,
  ai_available: aiConfigured(),
  ai_ack_required: workspace.aiAckRequired,
  ai_ack_at: workspace.workAiAckAt?.toISO() ?? null,
  storage_enabled: storageConfigured(),
})

export default class SettingsController {
  async show({ auth, workspace }: HttpContext) {
    return view(auth.getUserOrFail(), workspace)
  }

  /**
   * PATCH /settings. Lowering focus_limit below the active goals of any
   * workspace is refused: archive or complete goals first. Raising it
   * returns a suggestion_run_id for this workspace (null otherwise).
   *
   * Turning AI on where the workspace asks for the warning (every one but
   * the original Personal) needs acknowledged: true, every time, else 422
   * ack_required. Each one is recorded in ai_consents.
   */
  async update({ auth, request, workspace }: HttpContext) {
    const user = auth.getUserOrFail()
    const input = await request.validateUsing(updateSettingsValidator)
    const raised = input.focus_limit !== undefined && input.focus_limit > user.focusLimit
    const turningOn = input.ai_enabled === true && !workspace.aiEnabled
    const turningOff = input.ai_enabled === false && workspace.aiEnabled

    if (turningOn && workspace.aiAckRequired && input.acknowledged !== true) {
      throw new AppError(
        'ack_required',
        `Confirm the warning to turn on AI for ${workspace.displayName} (acknowledged: true).`,
        422
      )
    }

    if (input.focus_limit !== undefined) {
      const workspaces = await Workspace.query().where('user_id', user.id)
      const counts = await Promise.all(workspaces.map((w) => activeGoalCount(w.id)))
      const active = Math.max(0, ...counts)
      if (input.focus_limit < active) {
        const over = active - input.focus_limit
        throw AppError.validation(
          `Archive ${over} ${over === 1 ? 'goal' : 'goals'} to drop to ${input.focus_limit}.`
        )
      }
      user.focusLimit = input.focus_limit
    }
    if (input.timer_minutes !== undefined) user.timerMinutes = input.timer_minutes
    if (input.last_workspace_id !== undefined) {
      const own = await Workspace.query()
        .where('user_id', user.id)
        .where('id', input.last_workspace_id)
        .first()
      if (!own) throw AppError.validation("That workspace isn't yours.")
      user.lastWorkspaceId = own.id
    }
    await user.save()

    if (turningOn || turningOff) {
      await db.transaction(async (trx) => {
        workspace.useTransaction(trx)
        workspace.aiEnabled = turningOn
        if (turningOn && workspace.aiAckRequired) {
          workspace.workAiAckAt = DateTime.now()
          await trx.table('ai_consents').insert({
            user_id: user.id,
            workspace_id: workspace.id,
            workspace_name: workspace.displayName,
            ip: request.ip(),
            created_at: new Date(),
          })
        }
        await workspace.save()
      })
    }

    if (turningOn) {
      // Turned on: every open to-do the AI may judge shows as checking.
      await inWs(Todo, workspace)
        .where('done', false)
        .where((q) => q.whereNull('alignment_source').orWhere('alignment_source', 'ai'))
        .where((q) => q.whereNull('alignment_status').orWhereNot('alignment_status', 'dismissed'))
        .update({ alignment_status: 'pending', alignment_reason: null })
      await queueContextRecheck(workspace.id)
    } else if (turningOff) {
      // Turned off: nothing waits on a check any more.
      await inWs(Todo, workspace)
        .where('alignment_status', 'pending')
        .update({ alignment_status: null })
    }
    // Raising the limit opens spots: queue goal suggestions (after saving).
    const suggestionRunId = raised ? await startSuggestionRun(workspace.id, 'limit_raised') : null
    return { ...view(user, workspace), suggestion_run_id: suggestionRunId }
  }
}
