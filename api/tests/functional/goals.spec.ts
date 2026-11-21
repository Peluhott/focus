import { test } from '@japa/runner'
import type User from '#models/user'
import { freshUser } from '#tests/helpers'

let user: User

test.group('Goals and the focus limit', (group) => {
  group.each.setup(async () => {
    user = await freshUser(3)
  })

  async function createGoal(client: any, title: string) {
    return client.post('/api/v1/goals').json({ title }).loginAs(user).withCsrfToken()
  }

  test('a 4th active goal at limit 3 is 409 goal_limit_reached', async ({ client }) => {
    for (const t of ['one', 'two', 'three']) (await createGoal(client, t)).assertStatus(201)
    const fourth = await createGoal(client, 'four')
    fourth.assertStatus(409)
    fourth.assertBodyContains({ error: { code: 'goal_limit_reached' } })
  })

  test('completing a goal frees a slot', async ({ client }) => {
    const first = await createGoal(client, 'one')
    await createGoal(client, 'two')
    await createGoal(client, 'three')
    const done = await client
      .post(`/api/v1/goals/${first.body().id}/complete`)
      .loginAs(user)
      .withCsrfToken()
    done.assertBodyContains({ status: 'completed' })
    ;(await createGoal(client, 'four')).assertStatus(201)
  })

  test('restoring at the limit is 409; below it works', async ({ client }) => {
    const first = await createGoal(client, 'one')
    await client.post(`/api/v1/goals/${first.body().id}/archive`).loginAs(user).withCsrfToken()
    await createGoal(client, 'two')
    await createGoal(client, 'three')
    const four = await createGoal(client, 'four')

    const blocked = await client
      .post(`/api/v1/goals/${first.body().id}/restore`)
      .loginAs(user)
      .withCsrfToken()
    blocked.assertStatus(409)

    await client.post(`/api/v1/goals/${four.body().id}/archive`).loginAs(user).withCsrfToken()
    const restored = await client
      .post(`/api/v1/goals/${first.body().id}/restore`)
      .loginAs(user)
      .withCsrfToken()
    restored.assertStatus(200)
    restored.assertBodyContains({ status: 'active' })
  })

  test('the limit can be raised, but not lowered below the active count', async ({ client }) => {
    for (const t of ['one', 'two', 'three']) await createGoal(client, t)
    const raise = await client
      .patch('/api/v1/settings')
      .json({ focus_limit: 5 })
      .loginAs(user)
      .withCsrfToken()
    raise.assertBody({ focus_limit: 5, ai_enabled: true, ai_available: false })
    ;(await createGoal(client, 'four')).assertStatus(201)

    const lower = await client
      .patch('/api/v1/settings')
      .json({ focus_limit: 3 })
      .loginAs(user)
      .withCsrfToken()
    lower.assertStatus(422)
    lower.assertBodyContains({ error: { message: 'Archive 1 goal to drop to 3.' } })
  })

  test('focus_limit must be 3, 5 or 7', async ({ client }) => {
    const r = await client
      .patch('/api/v1/settings')
      .json({ focus_limit: 4 })
      .loginAs(user)
      .withCsrfToken()
    r.assertStatus(422)
  })

  test('goals list with sub-goals, progress and project count', async ({ client, assert }) => {
    const goal = (await createGoal(client, 'Ship Focus')).body()
    for (const t of ['API', 'Web', 'Tests']) {
      await client
        .post(`/api/v1/goals/${goal.id}/subgoals`)
        .json({ title: t })
        .loginAs(user)
        .withCsrfToken()
    }
    const subs = (await client.get(`/api/v1/goals/${goal.id}/subgoals`).loginAs(user)).body().data
    await client
      .patch(`/api/v1/subgoals/${subs[0].id}`)
      .json({ done: true })
      .loginAs(user)
      .withCsrfToken()
    // Move "Tests" above "API".
    await client
      .patch(`/api/v1/subgoals/${subs[2].id}`)
      .json({ before_id: subs[0].id })
      .loginAs(user)
      .withCsrfToken()
    await client
      .post('/api/v1/projects')
      .json({ title: 'P', goal_id: goal.id })
      .loginAs(user)
      .withCsrfToken()

    const list = (await client.get('/api/v1/goals?status=active').loginAs(user)).body().data
    assert.lengthOf(list, 1)
    assert.deepEqual(
      list[0].sub_goals.map((s: any) => s.title),
      ['Tests', 'API', 'Web']
    )
    assert.equal(list[0].sub_goals_done, 1)
    assert.equal(list[0].sub_goals_total, 3)
    assert.equal(list[0].projects_count, 1)
  })

  test('reordering goals', async ({ client, assert }) => {
    const a = (await createGoal(client, 'a')).body()
    await createGoal(client, 'b')
    const c = (await createGoal(client, 'c')).body()
    await client
      .patch(`/api/v1/goals/${c.id}`)
      .json({ before_id: a.id })
      .loginAs(user)
      .withCsrfToken()
    const list = (await client.get('/api/v1/goals?status=active').loginAs(user)).body().data
    assert.deepEqual(
      list.map((g: any) => g.title),
      ['c', 'a', 'b']
    )
  })

  test('deleting a goal unlinks its projects and removes its sub-goals', async ({ client }) => {
    const goal = (await createGoal(client, 'g')).body()
    await client
      .post(`/api/v1/goals/${goal.id}/subgoals`)
      .json({ title: 's' })
      .loginAs(user)
      .withCsrfToken()
    const project = (
      await client
        .post('/api/v1/projects')
        .json({ title: 'P', goal_id: goal.id })
        .loginAs(user)
        .withCsrfToken()
    ).body()

    const del = await client.delete(`/api/v1/goals/${goal.id}`).loginAs(user).withCsrfToken()
    del.assertStatus(204)
    const after = await client.get(`/api/v1/projects/${project.id}`).loginAs(user)
    after.assertBodyContains({ goal_id: null, goal: null })
  })
})
