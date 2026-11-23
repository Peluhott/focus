/*
|--------------------------------------------------------------------------
| HTTP limiters
|--------------------------------------------------------------------------
*/

import limiter from '@adonisjs/limiter/services/main'

/**
 * Login: 5 attempts per minute per IP (spec).
 */
export const loginThrottle = limiter.define('login', (ctx) => {
  return limiter.allowRequests(5).every('1 minute').usingKey(`login_${ctx.request.ip()}`)
})

/**
 * API keys: 120 requests per minute per key (spec). The web app's session
 * isn't limited. Runs after `auth`.
 */
export const apiThrottle = limiter.define('api', (ctx) => {
  if (ctx.auth.authenticatedViaGuard !== 'api') return limiter.noLimit()
  const token = ctx.auth.use('api').user?.currentAccessToken
  return limiter
    .allowRequests(120)
    .every('1 minute')
    .usingKey(`api_${String(token?.identifier)}`)
})
