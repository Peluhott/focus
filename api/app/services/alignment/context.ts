import { createHash } from 'node:crypto'
import aiConfig from '#config/ai'
import Goal from '#models/goal'
import Project from '#models/project'
import type { AlignmentContext } from './types.js'

const trim = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text

export const sha256 = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')

/**
 * Snapshot of what the model sees: active goals with their sub-goal titles,
 * and under each goal its planning or active projects with pending task
 * titles. Projects without a goal are left out: to-dos match goals only.
 * Order doesn't matter, so dragging never changes it.
 */
export async function buildContext(): Promise<AlignmentContext> {
  const { limits } = aiConfig
  const goals = await Goal.query()
    .where('status', 'active')
    .preload('subGoals', (q) => q.orderBy('position').orderBy('id'))
    .orderBy('id')
  const projects = await Project.query()
    .whereIn('status', ['planning', 'active'])
    .whereNotNull('goal_id')
    .whereNot('title', '')
    .preload('tasks', (q) => q.where('status', 'pending').orderBy('position').orderBy('id'))
    .orderBy('id')

  const snapshot = {
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      details: trim(g.details, limits.details),
      sub_goals: g.subGoals.slice(0, limits.subGoals).map((s) => s.title),
      projects: projects
        .filter((p) => p.goalId === g.id)
        .map((p) => ({
          title: p.title,
          details: trim(p.details, limits.details),
          pending_tasks: p.tasks.slice(0, limits.tasks).map((t) => t.title),
        })),
    })),
  }
  return { ...snapshot, version: sha256(snapshot) }
}

export function isEmpty(context: AlignmentContext) {
  return context.goals.length === 0
}

/** The to-do text the model sees, trimmed. */
export const todoInput = (todo: { title: string; notes: string }) => ({
  title: todo.title,
  notes: trim(todo.notes, aiConfig.limits.notes),
})
