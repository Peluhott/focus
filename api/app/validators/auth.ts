import vine from '@vinejs/vine'

/**
 * Emails are only trimmed and lowercased: never rewritten (no Gmail dot or
 * +tag stripping), so what you type at login is what sign-up stored.
 */
const email = () => vine.string().trim().toLowerCase().email()

export const loginValidator = vine.compile(
  vine.object({
    email: email(),
    password: vine.string(),
  })
)

/**
 * The rule sign-up used to apply (validator.js normalizeEmail: lowercase,
 * and Gmail/Outlook/iCloud dots and +tags removed). Accounts created back
 * then are stored in this form, so login also looks this form up.
 */
const legacyEmailValidator = vine.compile(
  vine.object({ email: vine.string().trim().email().normalizeEmail({ all_lowercase: true }) })
)

export async function legacyEmail(value: string): Promise<string | null> {
  try {
    const { email: normalized } = await legacyEmailValidator.validate({ email: value })
    return normalized
  } catch {
    return null
  }
}

/** Email sign-up. Passwords follow the same rule as PATCH /account (8+). */
export const signupValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(80),
    email: email(),
    password: vine.string().minLength(8).maxLength(200),
  })
)
