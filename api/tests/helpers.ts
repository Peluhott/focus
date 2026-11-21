import db from '@adonisjs/lucid/services/db'

const TABLES = [
  'alignment_checks',
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
  const { default: User } = await import('#models/user')
  return User.create({
    email: 'me@example.com',
    password: 'secret-pass',
    focusLimit,
    aiEnabled: true,
  })
}
