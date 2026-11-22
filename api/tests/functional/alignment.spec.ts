import { setTimeout as tick } from 'node:timers/promises'
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import AlignmentCheck from '#models/alignment_check'
import Goal from '#models/goal'
import Project from '#models/project'
import Todo from '#models/todo'
import type User from '#models/user'
import { AlignmentChecker } from '#services/alignment/checker'
import { AlignmentGuard } from '#services/alignment/guard'
import { useAlignmentQueue, type AlignmentQueue } from '#services/alignment/queue'
import { forceAiConfigured } from '#services/alignment/triggers'
import {
  ProviderError,
  type AlignmentContext,
  type AlignmentProvider,
  type TodoInput,
  type Verdict,
} from '#services/alignment/types'
import { freshUser } from '#tests/helpers'

/** Records what the API queued instead of talking to pg-boss. */
class FakeQueue implements AlignmentQueue {
  todos: number[] = []
  all = 0
  fail = false
  async checkTodo(id: number) {
    if (this.fail) throw new Error('queue down')
    this.todos.push(id)
  }
  async checkAll() {
    this.all++
  }
  async suggestGoals() {}
  async close() {}
}

/** A scripted model: returns (or throws) whatever `answer` says. */
class FakeProvider implements AlignmentProvider {
  readonly model = 'fake-model'
  calls: { todo: TodoInput; context: AlignmentContext }[] = []
  constructor(
    public answer: (todo: TodoInput, context: AlignmentContext) => Verdict | Promise<Verdict>
  ) {}
  async classifyAlignment(todo: TodoInput, context: AlignmentContext) {
    this.calls.push({ todo, context })
    const verdict = await this.answer(todo, context)
    return { verdict, usage: { inputTokens: 100, outputTokens: 20 }, latencyMs: 5 }
  }
}

const aligned = (type: 'goal', id: number): Verdict => ({
  aligned: true,
  confidence: 0.9,
  match: { type, id },
  reason: 'Moves it forward.',
})
const unaligned = (confidence: number): Verdict => ({
  aligned: false,
  confidence,
  match: { type: 'none', id: null },
  reason: "Doesn't serve any active goal or project.",
})

let user: User
let queue: FakeQueue

const checker = (provider: AlignmentProvider, guard = new AlignmentGuard()) =>
  new AlignmentChecker(provider, guard, [0, 0])

test.group('AI alignment check', (group) => {
  group.each.setup(async () => {
    user = await freshUser(3)
    queue = new FakeQueue()
    useAlignmentQueue(queue)
    forceAiConfigured(true)
    return () => {
      forceAiConfigured(undefined)
      useAlignmentQueue(null)
    }
  })

  const as = <T extends { loginAs: (u: User) => any }>(req: T) => req.loginAs(user).withCsrfToken()

  async function newTodo(client: any, title: string) {
    const res = await as(client.post('/api/v1/todos').json({ title }))
    res.assertStatus(201)
    return res.body()
  }

  test('with the AI off, nothing is queued and status stays null', async ({ client, assert }) => {
    forceAiConfigured(false)
    const todo = await newTodo(client, 'Buy shoes')
    assert.isNull(todo.alignment_status)
    assert.deepEqual(queue.todos, [])
    const settings = await as(client.get('/api/v1/settings'))
    settings.assertBodyContains({ ai_enabled: true, ai_available: false })
  })

  test('the Settings toggle turns it off for the account', async ({ client, assert }) => {
    await as(client.patch('/api/v1/settings').json({ ai_enabled: false }))
    const todo = await newTodo(client, 'Buy shoes')
    assert.isNull(todo.alignment_status)
    assert.deepEqual(queue.todos, [])
  })

  test('creating a to-do saves it as pending and queues a check', async ({ client, assert }) => {
    const todo = await newTodo(client, 'Buy shoes')
    assert.equal(todo.alignment_status, 'pending')
    assert.deepEqual(queue.todos, [todo.id])
  })

  test('if queuing fails the save still returns 201, as error', async ({ client, assert }) => {
    queue.fail = true
    const todo = await newTodo(client, 'Buy shoes')
    assert.equal(todo.alignment_status, 'error')
  })

  test('an aligned verdict stores the match; GET shows the chip', async ({ client, assert }) => {
    const goal = await Goal.create({
      title: 'Get fit',
      details: '',
      status: 'active',
      position: 'a0',
    })
    const todo = await newTodo(client, 'Buy running shoes')
    const provider = new FakeProvider(() => aligned('goal', goal.id))
    assert.equal(await checker(provider).checkTodo(todo.id), 'checked')

    const list = await as(client.get('/api/v1/todos'))
    list.assertBodyContains({
      data: [
        {
          alignment_status: 'aligned',
          alignment_source: 'ai',
          matched_goal_id: goal.id,
          matched_goal: { id: goal.id, title: 'Get fit' },
        },
      ],
    })
    // The model saw the goal, and the call was logged for cost tracking.
    assert.equal(provider.calls[0].context.goals[0].title, 'Get fit')
    const log = await AlignmentCheck.query().firstOrFail()
    assert.equal(log.inputTokens, 100)
    assert.deepEqual(log.verdict, aligned('goal', goal.id))
  })

  test('confident unaligned is red; unsure is aligned with no chip', async ({ client, assert }) => {
    await Goal.create({ title: 'Get fit', details: '', status: 'active', position: 'a0' })
    const red = await newTodo(client, 'Reorganize bookmarks')
    const unsure = await newTodo(client, 'Tidy the desk')
    const provider = new FakeProvider((t) => unaligned(t.title === 'Tidy the desk' ? 0.4 : 0.82))
    await checker(provider).checkTodo(red.id)
    await checker(provider).checkTodo(unsure.id)

    const a = await Todo.findOrFail(red.id)
    assert.equal(a.alignmentStatus, 'unaligned')
    assert.equal(a.alignmentReason, "Doesn't serve any active goal or project.")
    const b = await Todo.findOrFail(unsure.id)
    assert.equal(b.alignmentStatus, 'aligned')
    assert.isNull(b.matchedGoalId)
  })

  test('a match that is not an active goal gives no chip', async ({ client, assert }) => {
    await Goal.create({ title: 'Get fit', details: '', status: 'active', position: 'a0' })
    const todo = await newTodo(client, 'Buy shoes')
    await checker(new FakeProvider(() => aligned('goal', 999))).checkTodo(todo.id)
    const saved = await Todo.findOrFail(todo.id)
    assert.equal(saved.alignmentStatus, 'aligned')
    assert.isNull(saved.matchedGoalId)
  })

  test('projects show up under their goal; goal-less projects are left out', async ({
    client,
    assert,
  }) => {
    const goal = await Goal.create({
      title: 'Get fit',
      details: '',
      status: 'active',
      position: 'a0',
    })
    await Project.create({ title: 'Race plan', status: 'active', goalId: goal.id, position: 'a0' })
    await Project.create({ title: 'Garage', status: 'active', position: 'a1' })
    const todo = await newTodo(client, 'Book physio')
    const provider = new FakeProvider(() => aligned('goal', goal.id))
    await checker(provider).checkTodo(todo.id)
    const seen = provider.calls[0].context
    assert.deepEqual(
      seen.goals[0].projects.map((p) => p.title),
      ['Race plan']
    )
    assert.notInclude(JSON.stringify(seen), 'Garage')
  })

  test('unchanged text and context reuse the cached verdict', async ({ client, assert }) => {
    await Goal.create({ title: 'Get fit', details: '', status: 'active', position: 'a0' })
    const todo = await newTodo(client, 'Buy shoes')
    const provider = new FakeProvider(() => unaligned(0.9))
    assert.equal(await checker(provider).checkTodo(todo.id), 'checked')
    assert.equal(await checker(provider).checkTodo(todo.id), 'cached')
    assert.lengthOf(provider.calls, 1)

    // Dragging goals around doesn't change the context; new details do.
    await Goal.query().update({ position: 'b0' })
    assert.equal(await checker(provider).checkTodo(todo.id), 'cached')
    await Goal.query().update({ details: 'Run a half marathon' })
    assert.equal(await checker(provider).checkTodo(todo.id), 'checked')
  })

  test('with no active goals, to-dos are flagged without a model call', async ({
    client,
    assert,
  }) => {
    const todo = await newTodo(client, 'Buy shoes')
    const provider = new FakeProvider(() => aligned('goal', 1))
    await checker(provider).checkTodo(todo.id)
    assert.lengthOf(provider.calls, 0)
    const saved = await Todo.findOrFail(todo.id)
    assert.equal(saved.alignmentStatus, 'unaligned')
    assert.equal(saved.alignmentReason, 'There are no active goals to match.')
  })

  test('failed calls retry twice, are logged, then mark error', async ({ client, assert }) => {
    await Goal.create({ title: 'Get fit', details: '', status: 'active', position: 'a0' })
    const todo = await newTodo(client, 'Buy shoes')
    const provider = new FakeProvider(() => {
      throw new ProviderError('Timed out after 10000 ms', null, 10000)
    })
    assert.equal(await checker(provider).checkTodo(todo.id), 'failed')
    assert.lengthOf(provider.calls, 3)
    assert.lengthOf(await AlignmentCheck.all(), 3)
    const saved = await Todo.findOrFail(todo.id)
    assert.equal(saved.alignmentStatus, 'error')
  })

  test('5 failures in a row pause checks (circuit breaker)', async ({ client, assert }) => {
    await Goal.create({ title: 'Get fit', details: '', status: 'active', position: 'a0' })
    const one = await newTodo(client, 'one')
    const two = await newTodo(client, 'two')
    const three = await newTodo(client, 'three')
    let fail = true
    const provider = new FakeProvider(() => {
      if (fail) throw new ProviderError('Gemini 503: overloaded')
      return aligned('goal', 1)
    })
    const guard = new AlignmentGuard()
    const c = checker(provider, guard)
    await c.checkTodo(one.id) // 3 failures
    await c.checkTodo(two.id) // 2 more: the breaker opens
    fail = false
    assert.equal(await c.checkTodo(three.id), 'paused')
    assert.lengthOf(provider.calls, 5)
    assert.equal((await Todo.findOrFail(three.id)).alignmentStatus, 'error')
  })

  test('over the monthly budget, checks pause', async ({ client, assert }) => {
    await Goal.create({ title: 'Get fit', details: '', status: 'active', position: 'a0' })
    const todo = await newTodo(client, 'Buy shoes')
    // ~$6 of gemini-3.1-flash-lite output this month (cap is $5).
    await AlignmentCheck.create({
      model: 'gemini-3.1-flash-lite',
      contextVersion: 'x',
      inputTokens: 0,
      outputTokens: 4_000_000,
      latencyMs: 0,
    })
    const provider = new FakeProvider(() => aligned('goal', 1))
    assert.equal(await checker(provider).checkTodo(todo.id), 'paused')
    assert.lengthOf(provider.calls, 0)
  })

  test('a verdict for old text is dropped when the to-do changed meanwhile', async ({
    client,
    assert,
  }) => {
    await Goal.create({ title: 'Get fit', details: '', status: 'active', position: 'a0' })
    const todo = await newTodo(client, 'Buy shoes')
    const provider = new FakeProvider(async () => {
      await db.from('todos').where('id', todo.id).update({ title: 'Buy running shoes' })
      return unaligned(0.9)
    })
    await checker(provider).checkTodo(todo.id)
    assert.equal((await Todo.findOrFail(todo.id)).alignmentStatus, 'pending')
  })

  test('"This is fine" dismisses until the text changes', async ({ client, assert }) => {
    await Goal.create({ title: 'Get fit', details: '', status: 'active', position: 'a0' })
    const todo = await newTodo(client, 'Reorganize bookmarks')
    const provider = new FakeProvider(() => unaligned(0.9))
    await checker(provider).checkTodo(todo.id)

    const res = await as(client.post(`/api/v1/todos/${todo.id}/dismiss`))
    res.assertBodyContains({ alignment_status: 'dismissed' })
    assert.equal(await checker(provider).checkTodo(todo.id), 'skipped')

    // Same text: still dismissed. New text: checked again.
    await as(client.patch(`/api/v1/todos/${todo.id}`).json({ title: 'Reorganize bookmarks' }))
    assert.equal((await Todo.findOrFail(todo.id)).alignmentStatus, 'dismissed')
    const edited = await as(client.patch(`/api/v1/todos/${todo.id}`).json({ notes: 'work ones' }))
    edited.assertBodyContains({ alignment_status: 'pending' })
    assert.deepEqual(queue.todos, [todo.id, todo.id])
  })

  test('"Link to…" sets a manual goal link the AI never overwrites', async ({ client, assert }) => {
    const goal = await Goal.create({
      title: 'Get fit',
      details: '',
      status: 'active',
      position: 'a0',
    })
    const todo = await newTodo(client, 'Clean the garage')

    const linked = await as(
      client.patch(`/api/v1/todos/${todo.id}`).json({ matched_goal_id: goal.id })
    )
    linked.assertBodyContains({
      alignment_status: 'aligned',
      alignment_source: 'manual',
      matched_goal: { id: goal.id, title: 'Get fit' },
    })
    const provider = new FakeProvider(() => unaligned(0.9))
    assert.equal(await checker(provider).checkTodo(todo.id), 'skipped')
    // Editing the text doesn't touch a manual link either.
    const edited = await as(client.patch(`/api/v1/todos/${todo.id}`).json({ title: 'Clean it' }))
    edited.assertBodyContains({ alignment_source: 'manual', matched_goal_id: goal.id })

    // Unlink: back to the AI.
    const unlinked = await as(
      client.patch(`/api/v1/todos/${todo.id}`).json({ matched_goal_id: null })
    )
    unlinked.assertBodyContains({ alignment_status: 'pending', alignment_source: null })
    assert.deepEqual(queue.todos, [todo.id, todo.id])
  })

  test('"Link to…" only accepts active goals; projects are not link targets', async ({
    client,
    assert,
  }) => {
    const archived = await Goal.create({
      title: 'Old',
      details: '',
      status: 'archived',
      position: 'a0',
    })
    const project = await Project.create({ title: 'Garage', status: 'active', position: 'a0' })
    const todo = await newTodo(client, 'x')
    const url = `/api/v1/todos/${todo.id}`
    ;(await as(client.patch(url).json({ matched_goal_id: archived.id }))).assertStatus(422)
    const ignored = await as(client.patch(url).json({ matched_project_id: project.id }))
    assert.isNull(ignored.body().matched_project_id)
  })

  test('recheck queues a new check; 422 when the AI is off', async ({ client, assert }) => {
    const todo = await newTodo(client, 'Buy shoes')
    await Todo.query().where('id', todo.id).update({ alignment_status: 'error' })
    const res = await as(client.post(`/api/v1/todos/${todo.id}/recheck`))
    res.assertBodyContains({ alignment_status: 'pending' })
    assert.deepEqual(queue.todos, [todo.id, todo.id])

    forceAiConfigured(false)
    ;(await as(client.post(`/api/v1/todos/${todo.id}/recheck`))).assertStatus(422)
  })

  test('goal and project edits queue one batched re-check; drags do not', async ({
    client,
    assert,
  }) => {
    const a = await as(client.post('/api/v1/goals').json({ title: 'A' }))
    const b = await as(client.post('/api/v1/goals').json({ title: 'B' }))
    await tick(50)
    assert.equal(queue.all, 2)

    await as(client.patch(`/api/v1/goals/${b.body().id}`).json({ before_id: a.body().id }))
    await tick(50)
    assert.equal(queue.all, 2)

    await as(client.patch(`/api/v1/goals/${a.body().id}`).json({ details: 'why' }))
    await as(client.post(`/api/v1/goals/${a.body().id}/subgoals`).json({ title: 'step' }))
    await as(client.post('/api/v1/projects').json({ title: 'P' }))
    await tick(50)
    assert.equal(queue.all, 5)
  })

  test('turning the AI off clears pending; on re-checks everything', async ({ client, assert }) => {
    const todo = await newTodo(client, 'Buy shoes')
    await as(client.patch('/api/v1/settings').json({ ai_enabled: false }))
    assert.isNull((await Todo.findOrFail(todo.id)).alignmentStatus)
    const before = queue.all
    await as(client.patch('/api/v1/settings').json({ ai_enabled: true }))
    assert.equal(queue.all, before + 1)
  })

  test('checkAll skips done, dismissed and manually linked to-dos', async ({ client, assert }) => {
    const goal = await Goal.create({
      title: 'Get fit',
      details: '',
      status: 'active',
      position: 'a0',
    })
    const open = await newTodo(client, 'open')
    const dismissed = await newTodo(client, 'dismissed')
    const manual = await newTodo(client, 'manual')
    const done = await newTodo(client, 'done')
    await as(client.post(`/api/v1/todos/${dismissed.id}/dismiss`))
    await as(client.patch(`/api/v1/todos/${manual.id}`).json({ matched_goal_id: goal.id }))
    await as(client.patch(`/api/v1/todos/${done.id}`).json({ done: true }))

    const provider = new FakeProvider(() => unaligned(0.9))
    const counts = await checker(provider).checkAll()
    assert.equal(counts.checked, 1)
    assert.deepEqual(
      provider.calls.map((c) => c.todo.title),
      ['open']
    )
    assert.equal((await Todo.findOrFail(open.id)).alignmentStatus, 'unaligned')
  })
})
