import pg from 'pg'
import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

/**
 * Return DATE columns as plain "YYYY-MM-DD" strings. The default parser turns
 * them into JS Dates at local midnight, which shifts the day across timezones.
 */
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value)

const migrations = {
  naturalSort: true,
  paths: ['database/migrations'],
}

const dbConfig = defineConfig({
  connection: 'postgres',
  connections: {
    /**
     * App traffic, through Neon's pooler.
     */
    postgres: {
      client: 'pg',
      connection: env.get('DATABASE_URL'),
      pool: { min: 0, max: 10 },
      migrations,
    },

    /**
     * Direct (unpooled) connection for migrations, which take advisory locks
     * that PgBouncer in transaction mode can't hold.
     * Run with: node ace migration:run --connection=migrator
     */
    migrator: {
      client: 'pg',
      connection: env.get('DATABASE_URL_DIRECT'),
      pool: { min: 0, max: 2 },
      migrations,
    },
  },
})

export default dbConfig
