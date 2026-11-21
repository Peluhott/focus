import vine from '@vinejs/vine'
import { FOCUS_LIMITS } from '#models/user'

export const updateSettingsValidator = vine.compile(
  vine.object({
    focus_limit: vine.enum(FOCUS_LIMITS).optional(),
    ai_enabled: vine.boolean().optional(),
  })
)
