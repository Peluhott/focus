import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Workspace from '#models/workspace'

/**
 * A new account: the user plus its Personal (AI on) and Work (AI off)
 * workspaces, in one transaction. Used by sign-up and the boot seed.
 */
export async function createAccount(input: {
  email: string
  password: string
  displayName?: string | null
  focusLimit?: 3 | 5 | 7
}) {
  return db.transaction(async (trx) => {
    const user = await User.create(
      {
        email: input.email,
        password: input.password,
        displayName: input.displayName ?? null,
        focusLimit: input.focusLimit ?? 3,
        timerMinutes: 25,
        lastWorkspace: 'personal',
      },
      { client: trx }
    )
    await Workspace.createMany(
      [
        { userId: user.id, kind: 'personal', aiEnabled: true },
        { userId: user.id, kind: 'work', aiEnabled: false },
      ],
      { client: trx }
    )
    return user
  })
}

/** Whether an account already uses this email (case-insensitive). */
export async function emailTaken(email: string, exceptUserId?: number) {
  const query = User.query().whereRaw('lower(email) = ?', [email.toLowerCase()])
  if (exceptUserId !== undefined) query.whereNot('id', exceptUserId)
  return !!(await query.first())
}
