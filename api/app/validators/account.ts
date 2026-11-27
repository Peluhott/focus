import vine from '@vinejs/vine'

export const updateAccountValidator = vine.compile(
  vine.object({
    /** Shown in the app; empty clears it. */
    display_name: vine.string().trim().maxLength(80).nullable().optional(),
    email: vine.string().trim().toLowerCase().email().optional(),
    new_password: vine.string().minLength(8).maxLength(200).optional(),
    /** Needed to change the email or password. */
    current_password: vine.string().optional(),
  })
)
