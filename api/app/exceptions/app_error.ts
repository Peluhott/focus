import { Exception } from '@adonisjs/core/exceptions'

/**
 * An error with a spec error code, rendered as
 * { "error": { "code": "...", "message": "..." } } by the exception handler.
 */
export default class AppError extends Exception {
  constructor(
    public errorCode: string,
    message: string,
    status: number
  ) {
    super(message, { status, code: errorCode })
  }

  static goalLimitReached() {
    return new AppError(
      'goal_limit_reached',
      "You're at your limit. Complete or archive a goal, or raise your limit.",
      409
    )
  }

  static notFound(what = 'Resource') {
    return new AppError('not_found', `${what} not found.`, 404)
  }

  static validation(message: string) {
    return new AppError('validation_error', message, 422)
  }
}
