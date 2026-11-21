import env from '#start/env'
import { defineConfig } from '@adonisjs/cors'

/**
 * Configuration options to tweak the CORS policy. The following
 * options are documented on the official documentation website.
 *
 * https://docs.adonisjs.com/guides/security/cors
 */
const corsConfig = defineConfig({
  enabled: true,
  /**
   * Only the web app's origin, and only when it's on another origin. In local
   * dev Vite proxies /api, so no cross-origin requests happen at all.
   */
  origin: env.get('WEB_ORIGIN') ? [env.get('WEB_ORIGIN')!] : false,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
