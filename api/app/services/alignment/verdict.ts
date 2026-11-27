import vine from '@vinejs/vine'
import aiConfig from '#config/ai'
import type { AlignmentStatus } from '#models/todo'
import type { GoalLink } from '#services/matches'
import type { AlignmentContext, Verdict } from './types.js'

const resultShape = {
  aligned: vine.boolean({ strict: true }),
  confidence: vine.number({ strict: true }).min(0).max(1),
  matches: vine.array(
    vine.object({
      id: vine.number({ strict: true }).withoutDecimals(),
      confidence: vine.number({ strict: true }).min(0).max(1),
    })
  ),
  reason: vine.string().trim().minLength(1).maxLength(2000),
}

const batchValidator = vine.compile(
  vine.object({
    results: vine.array(vine.object({ todo: vine.string().trim(), ...resultShape })),
  })
)

const singleValidator = vine.compile(
  vine.object({
    ...resultShape,
    matches: vine.array(
      vine.object({
        type: vine.enum(['goal'] as const).optional(),
        id: vine.number({ strict: true }).withoutDecimals(),
        confidence: vine.number({ strict: true }).min(0).max(1),
      })
    ),
  })
)

/** Validate one verdict (no `todo` key); throws on a bad shape. */
export async function parseVerdict(raw: unknown): Promise<Verdict> {
  const v = await singleValidator.validate(raw)
  return {
    aligned: v.aligned,
    confidence: v.confidence,
    matches: v.matches.map((m) => ({ type: 'goal' as const, id: m.id, confidence: m.confidence })),
    reason: v.reason,
  }
}

/**
 * Validate the model's JSON (one result per to-do) against the schema;
 * throws on a bad shape. Returns verdicts by to-do key, in the shape the
 * cache stores (`matches[].type` is always "goal").
 */
export async function parseBatch(raw: unknown): Promise<Map<string, Verdict>> {
  const { results } = await batchValidator.validate(raw)
  const verdicts = new Map<string, Verdict>()
  for (const r of results) {
    if (verdicts.has(r.todo)) continue
    verdicts.set(r.todo, {
      aligned: r.aligned,
      confidence: r.confidence,
      matches: r.matches.map((m) => ({
        type: 'goal' as const,
        id: m.id,
        confidence: m.confidence,
      })),
      reason: r.reason,
    })
  }
  return verdicts
}

/** JSON Schema sent to the model (structured output): one result per to-do. */
export const BATCH_JSON_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          todo: { type: 'string' },
          aligned: { type: 'boolean' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          matches: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
              },
              required: ['id', 'confidence'],
            },
          },
          reason: { type: 'string' },
        },
        required: ['todo', 'aligned', 'confidence', 'matches', 'reason'],
      },
    },
  },
  required: ['results'],
}

export type Outcome = {
  status: Extract<AlignmentStatus, 'aligned' | 'unaligned'>
  reason: string
  /** Active goals matched with confidence ≥ 0.6, best first. */
  goals: GoalLink[]
}

const shorten = (text: string) => {
  const max = aiConfig.limits.reason
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/**
 * Verdict → what the to-do stores (spec "How it's shown", multi-goal spec):
 * - aligned: a link to every real active goal matched with confidence ≥ 0.6
 * - unaligned with confidence ≥ 0.6: red
 * - unaligned below 0.6: unsure, so treated as aligned with no chip
 */
export function toOutcome(verdict: Verdict, context: AlignmentContext): Outcome {
  const reason = shorten(verdict.reason)
  if (!verdict.aligned && verdict.confidence >= aiConfig.flagConfidence) {
    return { status: 'unaligned', reason, goals: [] }
  }
  if (!verdict.aligned) return { status: 'aligned', reason, goals: [] }
  // Older cached verdicts carry one `match` instead of `matches`.
  const matches =
    verdict.matches ??
    (verdict.match?.type === 'goal' && verdict.match.id !== null
      ? [{ type: 'goal' as const, id: verdict.match.id, confidence: verdict.confidence }]
      : [])
  const seen = new Set<number>()
  const goals = matches
    .filter((m) => m.type === 'goal' && m.confidence >= aiConfig.flagConfidence)
    .filter((m) => context.goals.some((g) => g.id === m.id))
    .filter((m) => !seen.has(m.id) && seen.add(m.id))
    .sort((a, b) => b.confidence - a.confidence)
    .map((m) => ({ id: m.id, confidence: m.confidence }))
  return { status: 'aligned', reason, goals }
}

/** With no active goals, every to-do is unaligned; no model call needed. */
export const NOTHING_ACTIVE: Outcome = {
  status: 'unaligned',
  reason: 'There are no active goals to match.',
  goals: [],
}
