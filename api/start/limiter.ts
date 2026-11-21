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
