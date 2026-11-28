import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { generateKeyBetween } from 'fractional-indexing'
import User, { type FocusLimit } from '#models/user'
import Workspace, { workspaceView } from '#models/workspace'
import { legacyEmail } from '#validators/auth'

/**
 * The workspaces every account starts with: Personal (AI on, no warning)
 * and Work (AI off, warning before turning it on). The user can rename,
 * reorder and delete them later; they always keep at least one.
 */
export async function createDefaultWorkspaces(
  userId: number,
  trx?: TransactionClientContract,
  focusLimit: FocusLimit = 3
) {
  const first = generateKeyBetween(null, null)
  const second = generateKeyBetween(first, null)
  return Workspace.createMany(
    [
      {
        userId,
        kind: 'personal',
        name: 'Personal',
        position: first,
        aiEnabled: true,
        aiAckRequired: false,
        focusLimit,
      },
      {
        userId,
        kind: 'work',
        name: 'Work',
        position: second,
        aiEnabled: false,
        aiAckRequired: true,
        focusLimit,
      },
    ],
    { client: trx }
  )
}

/**
 * A new account: the user plus its Personal and Work workspaces, in one
 * transaction. Used by sign-up and the boot seed.
 */
export async function createAccount(input: {
  email: string
  password: string
  displayName?: string | null
  focusLimit?: FocusLimit
}) {
  return db.transaction(async (trx) => {
    const user = await User.create(
      {
        email: input.email,
        password: input.password,
        displayName: input.displayName ?? null,
        focusLimit: input.focusLimit ?? 3,
        timerMinutes: 25,
      },
      { client: trx }
    )
    const [personal] = await createDefaultWorkspaces(user.id, trx, input.focusLimit ?? 3)
    user.lastWorkspaceId = personal.id
    await user.save()
    return user
  })
}

/**
 * The user's workspaces in order. Accounts from before workspaces (none at
 * all) get the defaults now; one the user deleted never comes back.
 */
export async function workspacesOf(userId: number) {
  let list = await Workspace.ofUser(userId)
  if (list.length === 0) {
    await db.transaction(async (trx) => {
      await trx.rawQuery('SELECT pg_advisory_xact_lock(hashtext(?))', [`workspaces:${userId}`])
      const again = await Workspace.query({ client: trx }).where('user_id', userId).first()
      if (!again) await createDefaultWorkspaces(userId, trx)
    })
    list = await Workspace.ofUser(userId)
  }
  return list
}

/** `{ user, workspaces }`: what auth/me, login and sign-up return. */
export async function meView(user: User) {
  const workspaces = await workspacesOf(user.id)
  return { user: user.serialize(), workspaces: workspaces.map(workspaceView) }
}

/**
 * Whether an account already uses this email (case-insensitive), or the
 * form older sign-ups stored it in (Gmail dots and +tags removed), so a
 * new account can't take over an older one's login.
 */
export async function emailTaken(email: string, exceptUserId?: number) {
  const lower = email.trim().toLowerCase()
  const legacy = await legacyEmail(lower)
  const candidates = [...new Set([lower, legacy].filter((e): e is string => !!e))]
  const query = User.query().whereRaw(
    `lower(email) IN (${candidates.map(() => '?').join(', ')})`,
    candidates
  )
  if (exceptUserId !== undefined) query.whereNot('id', exceptUserId)
  return !!(await query.first())
}

/** A unique-index violation on users' email (two sign-ups racing). */
export const isEmailConflict = (error: unknown) =>
  (error as { code?: string })?.code === '23505' &&
  String((error as { constraint?: string }).constraint ?? '').startsWith('users_email')
