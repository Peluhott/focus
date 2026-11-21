import { useQuery, useQueryClient } from '@tanstack/react-query'
import { del, fetchAll, patch, post } from './api'
import { meKey, type User } from './auth'
import { reorder, useOptimisticMutation } from './optimistic'
import { projectsRootKey } from './projects'
import type { Goal, GoalStatus, Placement, SubGoal } from './types'

export const goalsKey = ['goals'] as const
const key = () => goalsKey
const alsoProjects = () => [projectsRootKey]

/** Every goal (active, completed, archived) with its sub-goals. */
export function useGoals() {
  return useQuery({ queryKey: goalsKey, queryFn: () => fetchAll<Goal>('/goals') })
}

export const activeOf = (goals: Goal[] | undefined) =>
  (goals ?? []).filter((g) => g.status === 'active')

export function useCreateGoal() {
  return useOptimisticMutation<Goal, { tempId: number; title: string }, Goal[]>({
    scope: 'goals',
    queryKey: key,
    mutationFn: ({ title }) => post<Goal>('/goals', { title }),
    apply: (old, { tempId, title }) => [
      ...old,
      {
        id: tempId,
        title,
        details: '',
        status: 'active',
        position: '',
        completed_at: null,
        sub_goals: [],
        projects_count: 0,
      },
    ],
    settle: (old, goal, { tempId }) => old.map((g) => (g.id === tempId ? goal : g)),
  })
}

export function useUpdateGoal() {
  return useOptimisticMutation<
    Goal,
    { id: number; patch: Partial<Pick<Goal, 'title' | 'details'>> },
    Goal[]
  >({
    scope: 'goals',
    queryKey: key,
    mutationFn: ({ id, patch: body }) => patch<Goal>(`/goals/${id}`, body),
    apply: (old, { id, patch: body }) => old.map((g) => (g.id === id ? { ...g, ...body } : g)),
    alsoInvalidate: alsoProjects,
  })
}

export function useMoveGoal() {
  return useOptimisticMutation<Goal, { id: number; placement: Placement; order: Goal[] }, Goal[]>({
    scope: 'goals',
    queryKey: key,
    mutationFn: ({ id, placement }) => patch<Goal>(`/goals/${id}`, placement),
    apply: (old, { order }) => reorder(old, order),
  })
}

type StatusAction = 'complete' | 'archive' | 'restore'
const NEXT_STATUS: Record<StatusAction, GoalStatus> = {
  complete: 'completed',
  archive: 'archived',
  restore: 'active',
}

/** Complete, archive or restore. A restored goal goes to the bottom of the active list. */
export function useSetGoalStatus() {
  return useOptimisticMutation<Goal, { id: number; action: StatusAction }, Goal[]>({
    scope: 'goals',
    queryKey: key,
    mutationFn: ({ id, action }) => post<Goal>(`/goals/${id}/${action}`),
    apply: (old, { id, action }) => {
      const goal = old.find((g) => g.id === id)
      if (!goal) return old
      const updated = { ...goal, status: NEXT_STATUS[action] }
      return [...old.filter((g) => g.id !== id), updated]
    },
    alsoInvalidate: alsoProjects,
  })
}

export function useDeleteGoal() {
  return useOptimisticMutation<void, { id: number }, Goal[]>({
    scope: 'goals',
    queryKey: key,
    mutationFn: ({ id }) => del(`/goals/${id}`),
    apply: (old, { id }) => old.filter((g) => g.id !== id),
    alsoInvalidate: alsoProjects,
  })
}

// — sub-goals: edited inside the goals cache —

const withSubs = (old: Goal[], goalId: number, fn: (subs: SubGoal[]) => SubGoal[]) =>
  old.map((g) => (g.id === goalId ? { ...g, sub_goals: fn(g.sub_goals) } : g))

export function useAddSubGoal() {
  return useOptimisticMutation<SubGoal, { goalId: number; tempId: number; title: string }, Goal[]>({
    scope: 'goals',
    queryKey: key,
    mutationFn: ({ goalId, title }) => post<SubGoal>(`/goals/${goalId}/subgoals`, { title }),
    apply: (old, { goalId, tempId, title }) =>
      withSubs(old, goalId, (subs) => [
        ...subs,
        { id: tempId, goal_id: goalId, title, details: '', done: false, position: '' },
      ]),
    settle: (old, sub, { goalId, tempId }) =>
      withSubs(old, goalId, (subs) => subs.map((s) => (s.id === tempId ? sub : s))),
  })
}

export function useUpdateSubGoal() {
  return useOptimisticMutation<
    SubGoal,
    { goalId: number; id: number; patch: Partial<Pick<SubGoal, 'title' | 'details' | 'done'>> },
    Goal[]
  >({
    scope: 'goals',
    queryKey: key,
    mutationFn: ({ id, patch: body }) => patch<SubGoal>(`/subgoals/${id}`, body),
    apply: (old, { goalId, id, patch: body }) =>
      withSubs(old, goalId, (subs) => subs.map((s) => (s.id === id ? { ...s, ...body } : s))),
  })
}

export function useMoveSubGoal() {
  return useOptimisticMutation<
    SubGoal,
    { goalId: number; id: number; placement: Placement; order: SubGoal[] },
    Goal[]
  >({
    scope: 'goals',
    queryKey: key,
    mutationFn: ({ id, placement }) => patch<SubGoal>(`/subgoals/${id}`, placement),
    apply: (old, { goalId, order }) => withSubs(old, goalId, () => order),
  })
}

export function useDeleteSubGoal() {
  return useOptimisticMutation<void, { goalId: number; id: number }, Goal[]>({
    scope: 'goals',
    queryKey: key,
    mutationFn: ({ id }) => del(`/subgoals/${id}`),
    apply: (old, { goalId, id }) => withSubs(old, goalId, (subs) => subs.filter((s) => s.id !== id)),
  })
}

// — focus limit (stored on the user) —

export function useSetFocusLimit() {
  return useOptimisticMutation<unknown, { limit: 3 | 5 | 7 }, User | null>({
    scope: 'settings',
    queryKey: () => meKey,
    mutationFn: ({ limit }) => patch('/settings', { focus_limit: limit }),
    apply: (old, { limit }) => (old ? { ...old, focus_limit: limit } : old),
  })
}

/** Read the latest goals and limit at call time (for Undo callbacks). */
export function useLimitSnapshot() {
  const qc = useQueryClient()
  return () => {
    const goals = qc.getQueryData<Goal[]>(goalsKey)
    const user = qc.getQueryData<User | null>(meKey)
    return { active: activeOf(goals).length, limit: user?.focus_limit ?? 3 }
  }
}
