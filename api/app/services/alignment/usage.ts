import db from '@adonisjs/lucid/services/db'
import type { Usage } from './types.js'

/** What a model call was for. "carryover" rows came from ai_spend_carryovers (backfill). */
export type UsageKind = 'alignment' | 'suggestion' | 'hint'

/** A workspace's owner never changes, so the lookup is cached per process. */
const owners = new Map<number, number | null>()

export async function ownerOf(workspaceId: number): Promise<number | null> {
  if (owners.has(workspaceId)) return owners.get(workspaceId)!
  const row = await db.from('workspaces').where('id', workspaceId).select('user_id').first()
  const owner = (row?.user_id as number | undefined) ?? null
  // Don't cache "gone": a missing row is rare and should be looked up again.
  if (owner !== null) owners.set(workspaceId, owner)
  return owner
}

/**
 * Log the tokens of one model attempt (success or failure) in ai_usage,
 * the only source of the spend caps. Rows outlive the to-do, run and
 * workspace, so deleting anything can't reset the caps. Never throws: a
 * logging failure mustn't fail the job (it's logged by the caller's
 * logger instead).
 */
export async function recordUsage(entry: {
  workspaceId: number
  kind: UsageKind
  model: string
  usage: Usage | null
}) {
  const input = entry.usage?.inputTokens ?? 0
  const output = entry.usage?.outputTokens ?? 0
  if (input === 0 && output === 0) return
  const userId = await ownerOf(entry.workspaceId)
  if (userId === null) return
  await db.table('ai_usage').insert({
    user_id: userId,
    workspace_id: entry.workspaceId,
    kind: entry.kind,
    model: entry.model,
    input_tokens: input,
    output_tokens: output,
    created_at: new Date(),
  })
}
