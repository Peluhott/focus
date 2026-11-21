import { test } from '@japa/runner'
import type User from '#models/user'
import { freshUser } from '#tests/helpers'

let user: User

test.group('Projects and tasks', (group) => {
  group.each.setup(async () => {
    user = await freshUser()
  })

  const post = (client: any, url: string, body: object = {}) =>
    client.post(url).json(body).loginAs(user).withCsrfToken()
  const patch = (client: any, url: string, body: object) =>
    client.patch(url).json(body).loginAs(user).withCsrfToken()

  test('new projects start as planning with an empty title', async ({ client }) => {
    const r = await post(client, '/api/v1/projects')
    r.assertStatus(201)
    r.assertBodyContains({ title: '', status: 'planning', goal: null, open_task_count: 0 })
  })

  test('open_task_count and next_due', async ({ client, assert }) => {
    const p = (
      await post(client, '/api/v1/projects', { title: 'P', due_date: '2026-12-20' })
    ).body()
    await post(client, `/api/v1/projects/${p.id}/tasks`, { title: 'a', due_date: '2026-12-05' })
    await post(client, `/api/v1/projects/${p.id}/tasks`, { title: 'b' })
    const done = (
      await post(client, `/api/v1/projects/${p.id}/tasks`, { title: 'c', due_date: '2026-12-01' })
    ).body()
    await patch(client, `/api/v1/tasks/${done.id}`, { status: 'complete' })

    const row = (await client.get(`/api/v1/projects/${p.id}`).loginAs(user)).body()
    assert.equal(row.open_task_count, 2)
    // The completed task's earlier date doesn't count.
    assert.equal(row.next_due, '2026-12-05')
  })

  test('archived projects are hidden unless asked for', async ({ client, assert }) => {
    await post(client, '/api/v1/projects', { title: 'live' })
    await post(client, '/api/v1/projects', { title: 'old', status: 'archived' })
    const titles = async (qs: string) =>
      (await client.get(`/api/v1/projects${qs}`).loginAs(user)).body().data.map((p: any) => p.title)
    assert.deepEqual(await titles(''), ['live'])
    assert.deepEqual(await titles('?status=archived'), ['old'])
    assert.deepEqual(await titles('?status=all'), ['live', 'old'])
  })

  test('goal filter and linking rules', async ({ client, assert }) => {
    const goal = (await post(client, '/api/v1/goals', { title: 'G' })).body()
    await post(client, '/api/v1/projects', { title: 'linked', goal_id: goal.id })
    await post(client, '/api/v1/projects', { title: 'loose' })
    const titles = async (qs: string) =>
      (await client.get(`/api/v1/projects${qs}`).loginAs(user)).body().data.map((p: any) => p.title)
    assert.deepEqual(await titles(`?goal_id=${goal.id}`), ['linked'])
    assert.deepEqual(await titles('?goal_id=none'), ['loose'])

    await post(client, `/api/v1/goals/${goal.id}/archive`)
    const r = await post(client, '/api/v1/projects', { title: 'x', goal_id: goal.id })
    r.assertStatus(422)
    r.assertBodyContains({ error: { code: 'validation_error' } })
  })

  test('completing moves a task to the top of Complete; unchecking to the end of Pending', async ({
    client,
    assert,
  }) => {
    const p = (await post(client, '/api/v1/projects', { title: 'P' })).body()
    const ids: Record<string, number> = {}
    for (const t of ['a', 'b', 'c', 'd']) {
      ids[t] = (await post(client, `/api/v1/projects/${p.id}/tasks`, { title: t })).body().id
    }
    const list = async () =>
      (await client.get(`/api/v1/projects/${p.id}/tasks`).loginAs(user))
        .body()
        .data.map((t: any) => `${t.title}:${t.status[0]}`)

    await patch(client, `/api/v1/tasks/${ids.a}`, { status: 'complete' })
    await patch(client, `/api/v1/tasks/${ids.c}`, { status: 'complete' })
    assert.deepEqual(await list(), ['b:p', 'd:p', 'c:c', 'a:c'])

    await patch(client, `/api/v1/tasks/${ids.a}`, { status: 'pending' })
    assert.deepEqual(await list(), ['b:p', 'd:p', 'a:p', 'c:c'])

    await patch(client, `/api/v1/tasks/${ids.a}`, { before_id: ids.b })
    assert.deepEqual(await list(), ['a:p', 'b:p', 'd:p', 'c:c'])
  })

  test('deleting a project deletes its tasks', async ({ client }) => {
    const p = (await post(client, '/api/v1/projects', { title: 'P' })).body()
    const t = (await post(client, `/api/v1/projects/${p.id}/tasks`, { title: 'a' })).body()
    ;(await client.delete(`/api/v1/projects/${p.id}`).loginAs(user).withCsrfToken()).assertStatus(
      204
    )
    ;(await patch(client, `/api/v1/tasks/${t.id}`, { title: 'b' })).assertStatus(404)
  })
})
