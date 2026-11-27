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
 * Login: also 10 attempts per 15 minutes per account, which a spoofed
 * X-Forwarded-For (or a botnet) can't get around.
 */
export const loginAccountThrottle = limiter.define('login_account', (ctx) => {
  const email = String(ctx.request.input('email', '')).trim().toLowerCase()
  if (!email) return limiter.noLimit()
  return limiter.allowRequests(10).every('15 minutes').usingKey(`login_email_${email}`)
})

/**
 * Sign-up: 5 accounts per hour per IP.
 */
export const signupThrottle = limiter.define('signup', (ctx) => {
  return limiter.allowRequests(5).every('1 hour').usingKey(`signup_${ctx.request.ip()}`)
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
