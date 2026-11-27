import { createHash } from 'node:crypto'
import aiConfig from '#config/ai'
import Goal from '#models/goal'
import Project from '#models/project'
import type { AlignmentContext } from './types.js'

/** Trim and fold whitespace (newlines included), so user text stays on one line. */
export const trim = (text: string | null | undefined, max: number) => {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

export const sha256 = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')

/**
 * Snapshot of what the model sees, for one workspace: active goals with
 * short details, a few sub-goal titles and the titles of their planning or
 * active projects. Projects without a goal are left out (to-dos match goals
 * only), and so are project details and tasks. Order doesn't matter, so
 * dragging never changes it.
 */
export async function buildContext(workspaceId: number): Promise<AlignmentContext> {
  const { limits } = aiConfig
  const goals = await Goal.query()
    .where('workspace_id', workspaceId)
    .where('status', 'active')
    .preload('subGoals', (q) => q.orderBy('position').orderBy('id'))
    .orderBy('id')
  const projects = await Project.query()
    .where('workspace_id', workspaceId)
    .whereIn('status', ['planning', 'active'])
    .whereNotNull('goal_id')
    .whereNot('title', '')
    .select('id', 'title', 'goal_id')
    .orderBy('id')

  const snapshot = {
    goals: goals.map((g) => ({
      id: g.id,
      title: trim(g.title, limits.title),
      details: trim(g.details, limits.details),
      sub_goals: g.subGoals.slice(0, limits.subGoals).map((s) => trim(s.title, limits.item)),
      projects: projects
        .filter((p) => p.goalId === g.id)
        .slice(0, limits.projects)
        .map((p) => ({ title: trim(p.title, limits.item) })),
    })),
  }
  return { ...snapshot, version: sha256(snapshot) }
}

export function isEmpty(context: AlignmentContext) {
  return context.goals.length === 0
}

/**
 * The goals as compact lines, e.g.
 * `[3] Run a marathon: Train 4x a week | sub-goals: Buy shoes; 10k race | projects: Training plan`
 */
export function renderGoals(context: AlignmentContext) {
  return context.goals
    .map((g) => {
      let line = `[${g.id}] ${g.title}`
      if (g.details) line += `: ${g.details}`
      if (g.sub_goals.length) line += ` | sub-goals: ${g.sub_goals.join('; ')}`
      if (g.projects.length) line += ` | projects: ${g.projects.map((p) => p.title).join('; ')}`
      return line
    })
    .join('\n')
}

/** The to-do text the model sees, trimmed. */
export const todoInput = (todo: { title: string; notes: string }) => ({
  title: trim(todo.title, aiConfig.limits.title),
  notes: trim(todo.notes, aiConfig.limits.notes),
})
