/*
|--------------------------------------------------------------------------
| First-account seed
|--------------------------------------------------------------------------
|
| Anyone can sign up (POST /auth/signup) unless SIGNUP_ENABLED=false. On
| boot, if the users table is empty and ADMIN_EMAIL / ADMIN_PASSWORD are
| set, the first account is created from them.
| Once a user exists this does nothing, so changing the env vars later won't
| change the password.
|
*/

import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import User from '#models/user'
import { createAccount } from '#services/accounts'

const email = env.get('ADMIN_EMAIL')
const password = env.get('ADMIN_PASSWORD')

try {
  const existing = await User.query().count('* as total').first()
  const total = Number(existing?.$extras.total ?? 0)
  if (total === 0) {
    if (email && password) {
      await createAccount({ email, password })
      logger.info(`Seeded the account ${email}`)
    } else {
      logger.warn('No account yet. Sign up, or set ADMIN_EMAIL and ADMIN_PASSWORD and restart.')
    }
  }
} catch (error) {
  logger.warn(
    { err: error },
    'Account seed skipped (have the migrations run? node ace migration:run --connection=migrator)'
  )
}
