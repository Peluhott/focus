import type { HttpContext } from '@adonisjs/core/http'
import AppError from '#exceptions/app_error'
import User from '#models/user'
import env from '#start/env'
import { createAccount, emailTaken, isEmailConflict, meView } from '#services/accounts'
import { loginValidator, signupValidator } from '#validators/auth'

export default class AuthController {
  async login({ request, auth, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)
    const user = await User.verifyCredentials(email, password)
    await auth.use('web').login(user)
    return response.ok(await meView(user))
  }

  /**
   * POST /auth/signup { name, email, password }: a new account with its
   * Personal and Work workspaces, signed in. 422 email_taken when the email
   * already has an account; 403 signup_closed when SIGNUP_ENABLED=false.
   */
  async signup({ request, auth, response }: HttpContext) {
    if (env.get('SIGNUP_ENABLED') === false) {
      throw new AppError('signup_closed', 'Sign-up is closed.', 403)
    }
    const input = await request.validateUsing(signupValidator)
    if (await emailTaken(input.email)) {
      throw new AppError('email_taken', 'That email already has an account.', 422)
    }
    const user = await createAccount({
      email: input.email,
      password: input.password,
      displayName: input.name,
    }).catch((error) => {
      // Two sign-ups with the same email at once: the unique index stops one.
      if (isEmailConflict(error)) {
        throw new AppError('email_taken', 'That email already has an account.', 422)
      }
      throw error
    })
    await auth.use('web').login(user)
    await user.refresh()
    return response.created(await meView(user))
  }

  async logout({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    return response.noContent()
  }

  async me({ auth }: HttpContext) {
    return meView(auth.getUserOrFail())
  }
}
