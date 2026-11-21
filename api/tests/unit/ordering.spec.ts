import { test } from '@japa/runner'
import { generateKeyBetween } from 'fractional-indexing'
import db from '@adonisjs/lucid/services/db'

test.group('Fractional ordering', () => {
  test('keys stay strictly between neighbours after many inserts', ({ assert }) => {
    const a = generateKeyBetween(null, null)
    const b = generateKeyBetween(a, null)
    let low = a
    for (let i = 0; i < 50; i++) {
      const mid = generateKeyBetween(low, b)
      assert.isTrue(low < mid && mid < b)
      low = mid
    }
  })

  test('Postgres "C" collation sorts keys like JavaScript does', async ({ assert }) => {
    // Mixed case and digits: a default (linguistic) collation would interleave these.
    const keys = ['a0', 'a0V', 'Zz', 'a1', 'a0G', 'b00', 'A5']
    const { rows } = await db.rawQuery(
      `SELECT k FROM unnest(?::text[]) AS k ORDER BY k COLLATE "C"`,
      [keys]
    )
    assert.deepEqual(
      rows.map((r: { k: string }) => r.k),
      [...keys].sort()
    )
  })
})
