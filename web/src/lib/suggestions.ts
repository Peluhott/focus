import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { get, post } from './api'
import { offTrackKey } from './backlog'
import { goalsKey } from './goals'
import { errorMessage, useOptimisticMutation } from './optimistic'
import { useToast } from './toast'
import type { Goal, SuggestionsResponse } from './types'

export const suggestionsKey = ['goal-suggestions'] as const

/**
 * Open goal suggestions plus the latest run. Polls every 2 s while a run is
 * queued, so cards appear as soon as the worker is done.
 */
export function useSuggestions() {
  return useQuery({
    queryKey: suggestionsKey,
    queryFn: () => get<SuggestionsResponse>('/goal-suggestions'),
    refetchInterval: (q) => (q.state.data?.latest_run?.status === 'queued' ? 2_000 : false),
  })
}

export type SuggestionEdits = { title?: string; details?: string; sub_goals?: string[] }

/** Accept (optionally edited): creates the goal. Not optimistic; it needs the server's goal. */
export function useAcceptSuggestion() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ id, edits }: { id: number; edits?: SuggestionEdits }) =>
      post<Goal>(`/goal-suggestions/${id}/accept`, edits ?? {}),
    onSuccess: () => toast('Goal added'),
    onError: (error) => toast(errorMessage(error)),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: suggestionsKey }),
        qc.invalidateQueries({ queryKey: goalsKey }),
        qc.invalidateQueries({ queryKey: offTrackKey }),
      ]),
  })
}

export function useDismissSuggestion() {
  return useOptimisticMutation<unknown, { id: number }, SuggestionsResponse>({
    scope: 'suggestions',
    queryKey: () => suggestionsKey,
    mutationFn: ({ id }) => post(`/goal-suggestions/${id}/dismiss`),
    apply: (old, { id }) => ({ ...old, data: old.data.filter((s) => s.id !== id) }),
  })
}
