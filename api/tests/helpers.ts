import db from '@adonisjs/lucid/services/db'

const TABLES = [
  'alignment_checks',
  'workspaces',
  'api_keys',
  'todos',
  'tasks',
  'projects',
  'sub_goals',
  'goals',
  'users',
  'rate_limits',
]

/**
 * Empty every app table before a test. Runs before (not after) each test so a
 * failed run leaves its data behind for inspection.
 */
export async function resetDb() {
  await db.rawQuery(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`)
}

/** A fresh database with the single account, which tests log in as. */
export async function freshUser(focusLimit: 3 | 5 | 7 = 3) {
  await resetDb()
  const { createAccount } = await import('#services/accounts')
  return createAccount({ email: 'me@example.com', password: 'secret-pass', focusLimit })
}
