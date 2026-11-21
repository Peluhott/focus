import vine from '@vinejs/vine'
import aiConfig from '#config/ai'
import type { AlignmentStatus } from '#models/todo'
import type { AlignmentContext, Verdict } from './types.js'

const verdictValidator = vine.compile(
  vine.object({
    aligned: vine.boolean({ strict: true }),
    confidence: vine.number({ strict: true }).min(0).max(1),
    match: vine.object({
      type: vine.enum(['goal', 'none'] as const),
      id: vine.number({ strict: true }).withoutDecimals().nullable(),
    }),
    reason: vine.string().trim().minLength(1).maxLength(2000),
  })
)

/** Validate the model's JSON against the schema; throws on a bad shape. */
export async function parseVerdict(raw: unknown): Promise<Verdict> {
  return verdictValidator.validate(raw)
}

/** JSON Schema sent to the model (structured output). */
export const VERDICT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    aligned: { type: 'boolean' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    match: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['goal', 'none'] },
        id: { type: ['integer', 'null'] },
      },
      required: ['type', 'id'],
    },
    reason: { type: 'string' },
  },
  required: ['aligned', 'confidence', 'match', 'reason'],
}

export type Outcome = {
  status: Extract<AlignmentStatus, 'aligned' | 'unaligned'>
  reason: string
  matchedGoalId: number | null
}

const shorten = (text: string) => {
  const max = aiConfig.limits.reason
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/**
 * Verdict → what the to-do stores (spec "How it's shown"):
 * - aligned: chip for the matched goal, if it's a real active goal
 * - unaligned with confidence ≥ 0.6: red
 * - unaligned below 0.6: unsure, so treated as aligned with no chip
 */
export function toOutcome(verdict: Verdict, context: AlignmentContext): Outcome {
  const reason = shorten(verdict.reason)
  if (!verdict.aligned && verdict.confidence >= aiConfig.flagConfidence) {
    return { status: 'unaligned', reason, matchedGoalId: null }
  }
  const { type, id } = verdict.match
  const goalOk = verdict.aligned && type === 'goal' && context.goals.some((g) => g.id === id)
  return { status: 'aligned', reason, matchedGoalId: goalOk ? id : null }
}

/** With no active goals, every to-do is unaligned; no model call needed. */
export const NOTHING_ACTIVE: Outcome = {
  status: 'unaligned',
  reason: 'There are no active goals to match.',
  matchedGoalId: null,
}
