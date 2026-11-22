import { useQuery, type QueryClient } from '@tanstack/react-query'
import { get } from './api'

/**
 * All-time completion numbers behind "Focus so far" (GET /stats/completions).
 * Only completions made while the AI check was on count.
 */
export type CompletionStats = {
  total: number
  by_goal: { goal_id: number; count: number }[]
  /** Counted completions with no goal link. */
  off_goal: number
}

export const statsKey = ['stats', 'completions'] as const

export function useCompletionStats() {
  return useQuery({ queryKey: statsKey, queryFn: () => get<CompletionStats>('/stats/completions') })
}

/** Optimistically count (or un-count) one completion. */
export function bumpStats(qc: QueryClient, goalId: number | null, delta: 1 | -1) {
  qc.setQueryData<CompletionStats>(statsKey, (old) => {
    if (!old) return old
    const total = Math.max(0, old.total + delta)
    if (goalId === null) return { ...old, total, off_goal: Math.max(0, old.off_goal + delta) }
    const found = old.by_goal.some((g) => g.goal_id === goalId)
    const by_goal = found
      ? old.by_goal.map((g) => (g.goal_id === goalId ? { ...g, count: Math.max(0, g.count + delta) } : g))
      : delta > 0
        ? [...old.by_goal, { goal_id: goalId, count: 1 }]
        : old.by_goal
    return { ...old, total, by_goal }
  })
}
