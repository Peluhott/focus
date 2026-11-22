import { useQuery } from '@tanstack/react-query'
import { del, fetchAll, post } from './api'
import { useOptimisticMutation } from './optimistic'
import type { OffTrackItem } from './types'

export const offTrackKey = ['off-track'] as const

/** Open backlog entries, newest first. */
export function useOffTrack() {
  return useQuery({ queryKey: offTrackKey, queryFn: () => fetchAll<OffTrackItem>('/off-track') })
}

export function useRemoveOffTrack() {
  return useOptimisticMutation<void, { id: number }, OffTrackItem[]>({
    scope: 'off-track',
    queryKey: () => offTrackKey,
    mutationFn: ({ id }) => del(`/off-track/${id}`),
    apply: (old, { id }) => old.filter((i) => i.id !== id),
  })
}

export function useClearOffTrack() {
  return useOptimisticMutation<unknown, void, OffTrackItem[]>({
    scope: 'off-track',
    queryKey: () => offTrackKey,
    mutationFn: () => post('/off-track/clear'),
    apply: () => [],
  })
}
