import { useQuery } from '@tanstack/react-query'
import { get, patch } from './api'
import { meKey, type User } from './auth'
import { useOptimisticMutation } from './optimistic'
import { todosKey } from './todos'
import type { Settings } from './types'

export const settingsKey = ['settings'] as const

export function useSettings() {
  return useQuery({ queryKey: settingsKey, queryFn: () => get<Settings>('/settings'), staleTime: 60_000 })
}

/**
 * The AI check is running: switched on in Settings *and* set up on the
 * server. When false the UI shows no chips, flags, spinners or counts.
 */
export function useAiOn() {
  const { data } = useSettings()
  return !!data?.ai_enabled && !!data?.ai_available
}

export function useSetAiEnabled() {
  return useOptimisticMutation<Settings, { enabled: boolean }, Settings>({
    scope: 'settings',
    queryKey: () => settingsKey,
    mutationFn: ({ enabled }) => patch<Settings>('/settings', { ai_enabled: enabled }),
    apply: (old, { enabled }) => ({ ...old, ai_enabled: enabled }),
    alsoApply: (qc, { enabled }) => {
      qc.setQueryData<User | null>(meKey, (u) => (u ? { ...u, ai_enabled: enabled } : u))
    },
    alsoInvalidate: () => [todosKey, meKey],
  })
}
