import vine from '@vinejs/vine'
import { FOCUS_LIMITS } from '#models/user'

export const updateSettingsValidator = vine.compile(
  vine.object({
    focus_limit: vine.enum(FOCUS_LIMITS).optional(),
    /** This workspace's AI check. */
    ai_enabled: vine.boolean().optional(),
    /** The AI warning was confirmed (needed where the workspace asks for it). */
    acknowledged: vine.boolean().optional(),
    /** Default focus-timer length in minutes. */
    timer_minutes: vine.number().withoutDecimals().range([1, 180]).optional(),
    /** Workspace to open in next time (one of the user's ids). */
    last_workspace_id: vine.number().withoutDecimals().positive().optional(),
  })
)
