import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import AppError from '#exceptions/app_error'
import { emailTaken } from '#services/accounts'
import { updateAccountValidator } from '#validators/account'

export default class AccountController {
  /**
   * PATCH /account (session only): name, email and password. Changing the
   * email or password needs current_password. Returns { user } like /auth/me.
   */
  async update({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const input = await request.validateUsing(updateAccountValidator)

    const emailChanged = input.email !== undefined && input.email !== user.email
    if (emailChanged || input.new_password !== undefined) {
      if (!input.current_password) {
        throw AppError.validation('Enter your current password to change your email or password.')
      }
      if (!(await hash.verify(user.password, input.current_password))) {
        throw new AppError('invalid_password', 'Your current password is wrong.', 422)
      }
    }
    if (emailChanged) {
      if (await emailTaken(input.email!, user.id)) {
        throw new AppError('email_taken', 'That email already has an account.', 422)
      }
      user.email = input.email!
    }
    // withAuthFinder hashes it on save.
    if (input.new_password !== undefined) user.password = input.new_password
    if (input.display_name !== undefined) user.displayName = input.display_name || null

    await user.save()
    return { user: user.serialize() }
  }
}
