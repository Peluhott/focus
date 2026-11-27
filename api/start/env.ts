/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| Validates and casts the environment variables at boot.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
  /**
   * Daily log files in storage/logs (api.YYYY-MM-DD.N.log, worker.…). On
   * unless set to false; LOG_DAYS is how many files to keep (default 14).
   */
  LOG_FILES: Env.schema.boolean.optional(),
  LOG_DAYS: Env.schema.number.optional(),

  /**
   * Neon Postgres. The pooled URL serves the app; the direct URL is used
   * for migrations and (later) pg-boss, which need session-level locks.
   */
  DATABASE_URL: Env.schema.string(),
  DATABASE_URL_DIRECT: Env.schema.string(),

  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),
  LIMITER_STORE: Env.schema.enum(['database', 'memory'] as const),

  /**
   * The single account, seeded on boot when no user exists. Optional so the
   * app still boots without them; login just won't work until they're set.
   */
  ADMIN_EMAIL: Env.schema.string.optional({ format: 'email' }),
  ADMIN_PASSWORD: Env.schema.string.optional(),
  /** Email sign-up (POST /auth/signup). On unless set to false. */
  SIGNUP_ENABLED: Env.schema.boolean.optional(),

  /**
   * Browser origin allowed by CORS. Unset in local dev, where Vite proxies
   * /api so the browser only ever sees one origin.
   */
  WEB_ORIGIN: Env.schema.string.optional(),
  /**
   * Proxies in front of the API in production (Render + Vercel = 2), so
   * request.ip() is the client's address. See config/app.ts.
   */
  TRUSTED_PROXY_HOPS: Env.schema.number.optional(),

  /**
   * AI alignment check (Phase 6), run on Google Gemini. Off unless enabled
   * and a key is present.
   */
  AI_ENABLED: Env.schema.boolean.optional(),
  GEMINI_API_KEY: Env.schema.string.optional(),
  /** Gemini model id; defaults to gemini-3.1-flash-lite (config/ai.ts). */
  AI_MODEL: Env.schema.string.optional(),
  AI_MONTHLY_BUDGET_USD: Env.schema.number.optional(),
  AI_USER_MONTHLY_BUDGET_USD: Env.schema.number.optional(),

  /**
   * Project files on Cloudinary. Off unless all three are set; the Files
   * area then shows "File storage not set up".
   */
  CLOUDINARY_CLOUD_NAME: Env.schema.string.optional(),
  CLOUDINARY_API_KEY: Env.schema.string.optional(),
  CLOUDINARY_API_SECRET: Env.schema.string.optional(),
  /** Per-file limit in MB; keep at or below the Cloudinary plan's limit. */
  MAX_UPLOAD_MB: Env.schema.number.optional(),
})
