import vine from '@vinejs/vine'

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    password: vine.string(),
  })
)

/** Email sign-up. Passwords follow the same rule as PATCH /account (8+). */
export const signupValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(80),
    email: vine.string().trim().email().normalizeEmail({ all_lowercase: true }),
    password: vine.string().minLength(8).maxLength(200),
  })
)
