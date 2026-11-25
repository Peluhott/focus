import { useQuery } from '@tanstack/react-query'
import { get, patch } from './api'
import { meKey, type User } from './auth'
import { useOptimisticMutation } from './optimistic'
import { todosKey } from './todos'
import type { Settings } from './types'

/** Per workspace (each workspace has its own client), so ai_enabled is this workspace's. */
export const settingsKey = ['settings'] as const

export function useSettings() {
  return useQuery({ queryKey: settingsKey, queryFn: () => get<Settings>('/settings'), staleTime: 60_000 })
}

/**
 * The AI check is running in this workspace: switched on in Settings *and*
 * set up on the server. When false the UI shows no chips, flags, spinners,
 * counts or "Help me start".
 */
export function useAiOn() {
  const { data } = useSettings()
  return !!data?.ai_enabled && !!data?.ai_available
}

/**
 * Turning AI on in Work needs `acknowledged: true` (the warning dialog),
 * every time; the server records it.
 */
export function useSetAiEnabled() {
  return useOptimisticMutation<Settings, { enabled: boolean; acknowledged?: boolean }, Settings>({
    scope: 'settings',
    queryKey: () => settingsKey,
    mutationFn: ({ enabled, acknowledged }) =>
      patch<Settings>('/settings', acknowledged ? { ai_enabled: enabled, acknowledged } : { ai_enabled: enabled }),
    apply: (old, { enabled }) => ({ ...old, ai_enabled: enabled }),
    settle: (_old, saved) => saved,
    alsoInvalidate: () => [todosKey],
  })
}

/** Settings → Timer: the nav timer's default length (user level). */
export function useSetTimerMinutes() {
  return useOptimisticMutation<Settings, { minutes: number }, Settings>({
    scope: 'settings',
    queryKey: () => settingsKey,
    mutationFn: ({ minutes }) => patch<Settings>('/settings', { timer_minutes: minutes }),
    apply: (old, { minutes }) => ({ ...old, timer_minutes: minutes }),
    alsoApply: (qc, { minutes }) => {
      qc.setQueryData<User | null>(meKey, (u) => (u ? { ...u, timer_minutes: minutes } : u))
    },
  })
}
