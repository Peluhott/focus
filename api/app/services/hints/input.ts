import aiConfig from '#config/ai'
import Goal from '#models/goal'
import SubGoal from '#models/sub_goal'
import type Todo from '#models/todo'
import { sha256 } from '#services/alignment/context'
import { activeGoalIds } from '#services/matches'

/** Bump when the prompt changes, so cached hints are rebuilt. */
export const HINT_PROMPT_VERSION = 'hint-2-one-step'

const cut = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text

/** What the model sees for a to-do: its text and the active goals it serves. */
export async function hintInput(todo: Todo) {
  const goalIds = await activeGoalIds(todo.id)
  const goals = goalIds.length ? await Goal.query().whereIn('id', goalIds).orderBy('position') : []
  const subGoals = goalIds.length
    ? await SubGoal.query().whereIn('goal_id', goalIds).where('done', false).orderBy('position')
    : []
  return {
    todo: {
      title: todo.title,
      notes: cut(todo.notes, aiConfig.limits.notes),
      date: todo.date,
    },
    goals: goals.map((g) => ({
      title: g.title,
      details: cut(g.details, aiConfig.limits.details),
      open_sub_goals: subGoals
        .filter((s) => s.goalId === g.id)
        .slice(0, aiConfig.limits.subGoals)
        .map((s) => s.title),
    })),
  }
}

export type HintInput = Awaited<ReturnType<typeof hintInput>>

export const hintHash = (input: HintInput, model: string = aiConfig.model) =>
  sha256([HINT_PROMPT_VERSION, model, input])
