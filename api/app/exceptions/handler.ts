import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { errors as vineErrors } from '@vinejs/vine'
import { errors as authErrors } from '@adonisjs/auth'
import { errors as lucidErrors } from '@adonisjs/lucid'
import { errors as limiterErrors } from '@adonisjs/limiter'
import { errors as coreErrors } from '@adonisjs/core'
import AppError from '#exceptions/app_error'

type ErrorBody = { code: string; message: string; fields?: unknown }

/**
 * Every error leaves the API as { "error": { "code", "message" } }, with the
 * codes from the spec: unauthorized, missing_scope, not_found,
 * goal_limit_reached, validation_error, rate_limited.
 */
export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction

  async handle(error: unknown, ctx: HttpContext) {
    const mapped = this.map(error, ctx)
    if (mapped) {
      return ctx.response.status(mapped.status).send({ error: mapped.body })
    }
    if (this.debug) {
      return super.handle(error, ctx)
    }
    return ctx.response
      .status(500)
      .send({ error: { code: 'server_error', message: 'Something went wrong.' } })
  }

  private map(error: unknown, ctx: HttpContext): { status: number; body: ErrorBody } | null {
    if (error instanceof AppError) {
      return { status: error.status, body: { code: error.errorCode, message: error.message } }
    }
    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      const messages = error.messages as { field: string; message: string }[]
      return {
        status: 422,
        body: {
          code: 'validation_error',
          message: messages[0]?.message ?? 'Invalid input.',
          fields: messages,
        },
      }
    }
    if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
      return {
        status: 401,
        body: { code: 'invalid_credentials', message: 'Wrong email or password.' },
      }
    }
    if (error instanceof authErrors.E_UNAUTHORIZED_ACCESS) {
      return { status: 401, body: { code: 'unauthorized', message: 'Sign in first.' } }
    }
    if (error instanceof limiterErrors.E_TOO_MANY_REQUESTS) {
      const retryAfter = error.response.availableIn
      ctx.response.header('Retry-After', String(retryAfter))
      return {
        status: 429,
        body: {
          code: 'rate_limited',
          message: `Too many requests. Try again in ${retryAfter} seconds.`,
        },
      }
    }
    if (error instanceof lucidErrors.E_ROW_NOT_FOUND) {
      return { status: 404, body: { code: 'not_found', message: 'Not found.' } }
    }
    if (error instanceof coreErrors.E_ROUTE_NOT_FOUND) {
      return { status: 404, body: { code: 'not_found', message: 'No such endpoint.' } }
    }
    const code = (error as { code?: string })?.code
    // Postgres: invalid date/time value (e.g. 2026-02-30)
    if (code === '22007' || code === '22008') {
      return { status: 422, body: { code: 'validation_error', message: 'Invalid date.' } }
    }
    if (code === 'E_BAD_CSRF_TOKEN') {
      return {
        status: 403,
        body: { code: 'bad_csrf_token', message: 'Session expired. Reload the page.' },
      }
    }
    return null
  }

  /**
   * Added to every reported error line, so a log entry names the request,
   * user and workspace. Path only (no query string), no body or headers.
   */
  protected context(ctx: HttpContext) {
    return {
      ...super.context(ctx),
      method: ctx.request.method(),
      url: ctx.request.url(),
      route: ctx.route?.pattern,
      user_id: ctx.auth?.user?.id,
      workspace_id: ctx.workspace?.id,
    }
  }

  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
