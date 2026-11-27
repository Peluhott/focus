import aiConfig from '#config/ai'
import Goal from '#models/goal'
import type Todo from '#models/todo'
import { sha256, trim } from '#services/alignment/context'
import { activeGoalIds } from '#services/matches'

/** Bump when the prompt or input changes, so cached hints are rebuilt. */
export const HINT_PROMPT_VERSION = 'hint-3-compact'

/** A first step needs little: the to-do itself and the names of up to 2 goals it serves. */
const MAX_GOALS = 2

/** What the model sees for a to-do: its text and the titles of the active goals it serves. */
export async function hintInput(todo: Todo) {
  const goalIds = await activeGoalIds(todo.id)
  const goals = goalIds.length
    ? await Goal.query().whereIn('id', goalIds).orderBy('position').limit(MAX_GOALS).select('title')
    : []
  return {
    todo: trim(todo.title, aiConfig.limits.title),
    notes: trim(todo.notes, aiConfig.limits.notes),
    goals: goals.map((g) => trim(g.title, aiConfig.limits.item)),
  }
}

export type HintInput = Awaited<ReturnType<typeof hintInput>>

/** The user message: compact JSON, empty fields left out. */
export function hintPrompt(input: HintInput) {
  return JSON.stringify({
    todo: input.todo,
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.goals.length ? { goals: input.goals } : {}),
  })
}

export const hintHash = (input: HintInput, model: string = aiConfig.model) =>
  sha256([HINT_PROMPT_VERSION, model, input])
