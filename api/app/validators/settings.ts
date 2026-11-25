import vine from '@vinejs/vine'
import { FOCUS_LIMITS } from '#models/user'
import { WORKSPACE_KINDS } from '#models/workspace'

export const updateSettingsValidator = vine.compile(
  vine.object({
    focus_limit: vine.enum(FOCUS_LIMITS).optional(),
    /** This workspace's AI check. */
    ai_enabled: vine.boolean().optional(),
    /** The Work warning was confirmed (needed to turn AI on in Work). */
    acknowledged: vine.boolean().optional(),
    /** Default focus-timer length in minutes. */
    timer_minutes: vine.number().withoutDecimals().range([1, 180]).optional(),
    /** Workspace to open in next time. */
    last_workspace: vine.enum(WORKSPACE_KINDS).optional(),
  })
)
