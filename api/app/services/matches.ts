import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Goal from '#models/goal'
import TodoMatch from '#models/todo_match'
import type Todo from '#models/todo'

/**
 * Multi-goal matching (feature spec "Multi-goal matching"). A to-do's links
 * live in todo_matches; its color comes from those links and the current
 * number of active goals, with no AI call. Links to goals that aren't
 * active stop counting right away.
 */

export type MatchLevel = 'none' | 'one' | 'several' | 'all'
export type MatchView = { type: 'goal'; id: number; title: string; confidence: number | null }
export type GoalLink = { id: number; confidence: number | null }

/**
 * none: no goal · one: 1 goal (not all) · several: 2+ goals but not all ·
 * all: every active goal (so 1 of 1 and 2 of 2 are "all").
 */
export function matchLevel(matched: number, activeGoals: number): MatchLevel {
  if (matched === 0) return 'none'
  if (matched >= activeGoals) return 'all'
  return matched >= 2 ? 'several' : 'one'
}

/** Serialize to-dos with `matches` (active goals only) and `match_level`. */
export async function withMatchView(todos: Todo[]) {
  if (todos.length === 0) return []
  const [goals, links] = await Promise.all([
    Goal.query().where('status', 'active').select('id', 'title'),
    TodoMatch.query()
      .whereIn(
        'todo_id',
        todos.map((t) => t.id)
      )
      .where('target_type', 'goal')
      .orderBy('id'),
  ])
  const titles = new Map(goals.map((g) => [g.id, g.title]))
  const byTodo = new Map<number, MatchView[]>()
  for (const link of links) {
    const title = titles.get(link.targetId)
    if (title === undefined) continue
    const list = byTodo.get(link.todoId) ?? []
    list.push({ type: 'goal', id: link.targetId, title, confidence: link.confidence })
    byTodo.set(link.todoId, list)
  }
  return todos.map((todo) => {
    // Best match first; manual links (no confidence) lead.
    const matches = (byTodo.get(todo.id) ?? []).sort(
      (a, b) => (b.confidence ?? 2) - (a.confidence ?? 2)
    )
    return {
      ...todo.serialize(),
      matches,
      match_level: matchLevel(matches.length, goals.length),
    }
  })
}

export async function withMatchViewOne(todo: Todo) {
  const [row] = await withMatchView([todo])
  return row
}

/** Replace a to-do's goal links. */
export async function setMatches(
  todoId: number,
  goals: GoalLink[],
  trx?: TransactionClientContract
) {
  const client = trx ?? db
  await client.from('todo_matches').where('todo_id', todoId).delete()
  if (goals.length === 0) return
  const now = new Date()
  await client.table('todo_matches').multiInsert(
    goals.map((g) => ({
      todo_id: todoId,
      target_type: 'goal',
      target_id: g.id,
      confidence: g.confidence,
      created_at: now,
    }))
  )
}

/** Ids of the active goals a to-do links to (snapshot for a completion). */
export async function activeGoalIds(todoId: number, trx?: TransactionClientContract) {
  const rows = await (trx ?? db)
    .from('todo_matches')
    .join('goals', 'goals.id', 'todo_matches.target_id')
    .where('todo_matches.todo_id', todoId)
    .where('todo_matches.target_type', 'goal')
    .where('goals.status', 'active')
    .select('goals.id')
  return rows.map((r: { id: number }) => r.id)
}
