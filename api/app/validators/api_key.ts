import vine from '@vinejs/vine'
import { API_SCOPES } from '#middleware/scope_middleware'
import { isoDate } from '#validators/common'

export const createApiKeyValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(100),
    scopes: vine.array(vine.enum(API_SCOPES)).minLength(1).distinct(),
    /** Last day the key works ("YYYY-MM-DD", UTC). Empty: never expires. */
    expires_on: isoDate().nullable().optional(),
  })
)
