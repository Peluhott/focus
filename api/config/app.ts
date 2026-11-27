import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { Secret } from '@adonisjs/core/helpers'
import { defineConfig } from '@adonisjs/core/http'

/**
 * The app key is used for encrypting cookies, generating signed URLs,
 * and by the "encryption" module.
 *
 * The encryption module will fail to decrypt data if the key is lost or
 * changed. Therefore it is recommended to keep the app key secure.
 */
export const appKey = new Secret(env.get('APP_KEY'))

/**
 * The configuration settings used by the HTTP server
 */
/**
 * In production every request comes through Vercel's edge (the /api
 * rewrite) and then Render's proxy, so request.ip() must skip those hops or
 * every user shares one rate-limit bucket. TRUSTED_PROXY_HOPS (default 2)
 * is how many proxies, counted from the server, are trusted; the address
 * before them is the client. Locally only loopback is trusted.
 */
const trustedHops = env.get('TRUSTED_PROXY_HOPS') ?? 2

export const http = defineConfig({
  generateRequestId: true,
  allowMethodSpoofing: false,
  ...(app.inProduction ? { trustProxy: (_address: string, hop: number) => hop < trustedHops } : {}),

  /**
   * Enabling async local storage will let you access HTTP context
   * from anywhere inside your application.
   */
  useAsyncLocalStorage: false,

  /**
   * Manage cookies configuration. The settings for the session id cookie are
   * defined inside the "config/session.ts" file.
   */
  cookie: {
    domain: '',
    path: '/',
    maxAge: '2h',
    httpOnly: true,
    secure: app.inProduction,
    sameSite: 'lax',
  },
})
