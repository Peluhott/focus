import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, targets } from '@adonisjs/core/logger'

/**
 * Daily log files, like Laravel's storage/logs: storage/logs/api.2026-11-27.1.log
 * for the HTTP server, worker.… for ace commands (align:work). Separate files
 * so two processes never rotate the same one. JSON lines; `npm run logs` reads
 * them. Days follow TZ (UTC). Off in tests and with LOG_FILES=false.
 */
const fileLogs = app.getEnvironment() !== 'test' && env.get('LOG_FILES', true)
const fileTarget = {
  target: 'pino-roll',
  level: env.get('LOG_LEVEL'),
  options: {
    file: app.makePath('storage/logs', app.getEnvironment() === 'web' ? 'api' : 'worker'),
    frequency: 'daily',
    dateFormat: 'yyyy-MM-dd',
    extension: '.log',
    mkdir: true,
    limit: { count: env.get('LOG_DAYS', 14) },
  },
}

const loggerConfig = defineConfig({
  default: 'app',

  /**
   * The loggers object can be used to define multiple loggers.
   * By default, we configure only one logger (named "app").
   */
  loggers: {
    app: {
      enabled: true,
      name: env.get('APP_NAME'),
      level: env.get('LOG_LEVEL'),
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .pushIf(app.inProduction, targets.file({ destination: 1 }))
          .pushIf(fileLogs, fileTarget)
          .toArray(),
      },
    },
  },
})

export default loggerConfig

/**
 * Inferring types for the list of loggers you have configured
 * in your application.
 */
declare module '@adonisjs/core/types' {
  export interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}
