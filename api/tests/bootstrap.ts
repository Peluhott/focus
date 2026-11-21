import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import { sessionApiClient } from '@adonisjs/session/plugins/api_client'
import { authApiClient } from '@adonisjs/auth/plugins/api_client'
import { shieldApiClient } from '@adonisjs/shield/plugins/api_client'
import testUtils from '@adonisjs/core/services/test_utils'
import ace from '@adonisjs/core/services/ace'

/**
 * Tests run against the Neon "test" branch (see .env.test).
 */
export const plugins: Config['plugins'] = [
  assert(),
  apiClient(),
  pluginAdonisJS(app),
  sessionApiClient(app),
  shieldApiClient(),
  authApiClient(app),
]

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  /**
   * Migrate the test branch up to date (no rollback afterwards, so the schema
   * stays for the next run).
   */
  setup: [
    async () => {
      const command = await ace.exec('migration:run', ['--connection=migrator', '--force'])
      if (command.exitCode) throw command.error ?? new Error('Migrations failed')
    },
  ],
  teardown: [],
}

export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    return suite.setup(() => testUtils.httpServer().start())
  }
}
