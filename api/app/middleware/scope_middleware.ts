import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import AppError from '#exceptions/app_error'

export const API_SCOPES = [
  'goals:read',
  'goals:write',
  'projects:read',
  'projects:write',
  'todos:read',
  'todos:write',
] as const
export type ApiScope = (typeof API_SCOPES)[number]

/**
 * Scopes for API keys (spec "REST API and API keys"). A signed-in session can
 * do everything; a key needs the route's scope or gets 403 missing_scope.
 * Runs after `auth`.
 */
export default class ScopeMiddleware {
  async handle(ctx: HttpContext, next: NextFn, scope: ApiScope) {
    if (ctx.auth.authenticatedViaGuard === 'api') {
      const token = ctx.auth.use('api').user?.currentAccessToken
      if (!token || !token.allows(scope)) {
        throw new AppError('missing_scope', `This API key needs the ${scope} scope.`, 403)
      }
    }
    return next()
  }
}
