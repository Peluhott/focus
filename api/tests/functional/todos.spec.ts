import { test } from '@japa/runner'
import type User from '#models/user'
import { freshUser } from '#tests/helpers'

let user: User

test.group('To-dos', (group) => {
  group.each.setup(async () => {
    user = await freshUser()
  })

  const titles = (body: any) => body.data.map((t: any) => t.title)

  test('needs a session', async ({ client }) => {
    const response = await client.get('/api/v1/todos')
    response.assertStatus(401)
    response.assertBodyContains({ error: { code: 'unauthorized' } })
  })

  test('new to-dos go on top', async ({ client, assert }) => {
    for (const title of ['first', 'second', 'third']) {
      const r = await client.post('/api/v1/todos').json({ title }).loginAs(user).withCsrfToken()
      r.assertStatus(201)
    }
    const list = await client.get('/api/v1/todos').loginAs(user)
    assert.deepEqual(titles(list.body()), ['third', 'second', 'first'])
    assert.isNull(list.body().data[0].alignment_status)
    assert.isNull(list.body().next_cursor)
  })

  test('empty title is 422', async ({ client }) => {
    const r = await client.post('/api/v1/todos').json({ title: '  ' }).loginAs(user).withCsrfToken()
    r.assertStatus(422)
    r.assertBodyContains({ error: { code: 'validation_error' } })
  })

  test('impossible date is 422', async ({ client }) => {
    const r = await client
      .post('/api/v1/todos')
      .json({ title: 'x', date: '2026-02-30' })
      .loginAs(user)
      .withCsrfToken()
    r.assertStatus(422)
  })

  test('reorder with before_id and after_id', async ({ client, assert }) => {
    const ids: Record<string, number> = {}
    for (const title of ['c', 'b', 'a']) {
      const r = await client.post('/api/v1/todos').json({ title }).loginAs(user).withCsrfToken()
      ids[title] = r.body().id
    }
    // list is a, b, c. Move c above a, then a below b.
    await client
      .patch(`/api/v1/todos/${ids.c}`)
      .json({ before_id: ids.a })
      .loginAs(user)
      .withCsrfToken()
    let list = await client.get('/api/v1/todos').loginAs(user)
    assert.deepEqual(titles(list.body()), ['c', 'a', 'b'])

    await client
      .patch(`/api/v1/todos/${ids.a}`)
      .json({ after_id: ids.b })
      .loginAs(user)
      .withCsrfToken()
    list = await client.get('/api/v1/todos').loginAs(user)
    assert.deepEqual(titles(list.body()), ['c', 'b', 'a'])
  })

  test('placing next to an unknown item is 422', async ({ client }) => {
    const r = await client.post('/api/v1/todos').json({ title: 'x' }).loginAs(user).withCsrfToken()
    const move = await client
      .patch(`/api/v1/todos/${r.body().id}`)
      .json({ before_id: 99999 })
      .loginAs(user)
      .withCsrfToken()
    move.assertStatus(422)
  })

  test('done hides it; undone puts it back in the same place', async ({ client, assert }) => {
    const ids: number[] = []
    for (const title of ['c', 'b', 'a']) {
      const r = await client.post('/api/v1/todos').json({ title }).loginAs(user).withCsrfToken()
      ids.push(r.body().id)
    }
    const b = ids[1]
    const done = await client
      .patch(`/api/v1/todos/${b}`)
      .json({ done: true })
      .loginAs(user)
      .withCsrfToken()
    assert.isNotNull(done.body().done_at)

    let list = await client.get('/api/v1/todos').loginAs(user)
    assert.deepEqual(titles(list.body()), ['a', 'c'])
    const doneList = await client.get('/api/v1/todos?done=true').loginAs(user)
    assert.deepEqual(titles(doneList.body()), ['b'])

    await client.patch(`/api/v1/todos/${b}`).json({ done: false }).loginAs(user).withCsrfToken()
    list = await client.get('/api/v1/todos').loginAs(user)
    assert.deepEqual(titles(list.body()), ['a', 'b', 'c'])
  })

  test('cursor pagination walks the whole list', async ({ client, assert }) => {
    for (let i = 0; i < 5; i++) {
      await client
        .post('/api/v1/todos')
        .json({ title: `t${i}` })
        .loginAs(user)
        .withCsrfToken()
    }
    const seen: string[] = []
    let cursor: string | null = null
    do {
      const url: string = `/api/v1/todos?limit=2${cursor ? `&cursor=${cursor}` : ''}`
      const page: any = await client.get(url).loginAs(user)
      seen.push(...titles(page.body()))
      cursor = page.body().next_cursor
    } while (cursor)
    assert.deepEqual(seen, ['t4', 't3', 't2', 't1', 't0'])
  })

  test('concurrent creates never share a position', async ({ client, assert }) => {
    await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        client
          .post('/api/v1/todos')
          .json({ title: `t${i}` })
          .loginAs(user)
          .withCsrfToken()
      )
    )
    const list = await client.get('/api/v1/todos').loginAs(user)
    const positions = list.body().data.map((t: any) => t.position)
    assert.lengthOf(positions, 6)
    assert.lengthOf(new Set(positions), 6)
  })

  test('delete', async ({ client }) => {
    const r = await client.post('/api/v1/todos').json({ title: 'x' }).loginAs(user).withCsrfToken()
    const del = await client.delete(`/api/v1/todos/${r.body().id}`).loginAs(user).withCsrfToken()
    del.assertStatus(204)
    const gone = await client.get(`/api/v1/todos/${r.body().id}`).loginAs(user)
    gone.assertStatus(404)
    gone.assertBodyContains({ error: { code: 'not_found' } })
  })
})
