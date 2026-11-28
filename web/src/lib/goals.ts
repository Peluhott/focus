import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { del, fetchAll, patch, post } from './api'
import { deferDelete, flushPendingDeletes, isHidden, useHiddenVersion } from './pendingDeletes'
import { rootClient } from './queryClient'
import { reorder, useOptimisticMutation } from './optimistic'
import { projectsRootKey } from './projects'
import type { Goal, GoalStatus, Placement, Settings, SubGoal, WorkspaceInfo } from './types'
import { useWorkspace } from './workspace'
import { patchWorkspaceInList, useCurrentWorkspaceInfo, workspacesKey } from './workspaces'

export const goalsKey = ['goals'] as const
const key = () => goalsKey
const alsoProjects = () => [projectsRootKey]

/** Every goal (active, completed, archived) with its sub-goals. */
export function useGoals() {
  const v = useHiddenVersion()
  // Goals and sub-goals whose delete is waiting on its Undo stay out of view.
  const select = useCallback(
    (list: Goal[]) =>
      list
        .filter((g) => !isHidden('goal', g.id))
        .map((g) =>
          g.sub_goals.some((s) => isHidden('subgoal', s.id))
            ? { ...g, sub_goals: g.sub_goals.filter((s) => !isHidden('subgoal', s.id)) }
            : g
        ),
    [v]
  )
  return useQuery({ queryKey: goalsKey, queryFn: () => fetchAll<Goal>('/goals'), select })
}

export const activeOf = (goals: Goal[] | undefined) =>
  (goals ?? []).filter((g) => g.status === 'active')

export function useCreateGoal() {
  return useOptimisticMutation<Goal, { tempId: number; title: string }, Goal[]>({
    scope: 'goals',
    queryKey: key,
    mutationFn: async ({ title }) => {
      // A goal deleted a moment ago still counts toward the limit until it's sent.
      await flushPendingDeletes('goal')
      return post<Goal>('/goals', { title })
    },
    apply: (old, { tempId, title }) => [
      ...old,
      {
        id: tempId,
        title,
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
    { id: number; patch: Partial<Pick<Goal, 'title'>> },
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
    mutationFn: async ({ id, action }) => {
      if (action === 'restore') await flushPendingDeletes('goal')
      return post<Goal>(`/goals/${id}/${action}`)
    },
    apply: (old, { id, action }) => {
      const goal = old.find((g) => g.id === id)
      if (!goal) return old
      const updated = { ...goal, status: NEXT_STATUS[action] }
      return [...old.filter((g) => g.id !== id), updated]
    },
    alsoInvalidate: alsoProjects,
  })
}

/** Delete with Undo (UNDO.md): gone now, sent when the toast ends. */
export function useDeleteGoal() {
  const qc = useQueryClient()
  return (goal: Goal) =>
    deferDelete(qc, {
      kind: 'goal',
      id: goal.id,
      title: goal.title,
      lists: [goalsKey],
      commit: () => del(`/goals/${goal.id}`),
      afterCommit: () => {
        qc.invalidateQueries({ queryKey: projectsRootKey })
        qc.invalidateQueries({ queryKey: ['todos'] })
      },
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
        { id: tempId, goal_id: goalId, title, done: false, position: '' },
      ]),
    settle: (old, sub, { goalId, tempId }) =>
      withSubs(old, goalId, (subs) => subs.map((s) => (s.id === tempId ? sub : s))),
  })
}

export function useUpdateSubGoal() {
  return useOptimisticMutation<
    SubGoal,
    { goalId: number; id: number; patch: Partial<Pick<SubGoal, 'title' | 'done'>> },
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
  const qc = useQueryClient()
  const remove = (goalId: number, id: number) => {
    let index = -1
    let sub: SubGoal | undefined
    qc.setQueryData<Goal[]>(goalsKey, (old) =>
      old
        ? withSubs(old, goalId, (subs) => {
            index = subs.findIndex((s) => s.id === id)
            sub = subs[index]
            return subs.filter((s) => s.id !== id)
          })
        : old
    )
    return () => {
      if (!sub || index < 0) return
      const back = sub
      qc.setQueryData<Goal[]>(goalsKey, (old) =>
        old
          ? withSubs(old, goalId, (subs) => {
              if (subs.some((s) => s.id === id)) return subs
              const next = [...subs]
              next.splice(Math.min(index, next.length), 0, back)
              return next
            })
          : old
      )
    }
  }
  return (sub: SubGoal) =>
    deferDelete(qc, {
      kind: 'subgoal',
      id: sub.id,
      title: sub.title,
      remove: () => remove(sub.goal_id, sub.id),
      commit: () => del(`/subgoals/${sub.id}`),
    })
}

// — focus limit (per workspace, kept in the root workspace list) —

/** This workspace's goal limit (3 until the list has loaded). */
export function useFocusLimit(): 3 | 5 | 7 {
  return useCurrentWorkspaceInfo()?.focus_limit ?? 3
}

/**
 * PATCH /settings { focus_limit } for the current workspace. Optimistic on
 * the workspace list; resolves with the settings (suggestion_run_id when raised).
 */
export function useSetFocusLimit() {
  const { workspace } = useWorkspace()
  return useMutation(
    {
      mutationFn: ({ limit }: { limit: 3 | 5 | 7 }) =>
        patch<Settings & { suggestion_run_id: number | null }>('/settings', { focus_limit: limit }),
      onMutate: ({ limit }) => {
        const before = rootClient
          .getQueryData<WorkspaceInfo[]>(workspacesKey)
          ?.find((w) => w.id === workspace)?.focus_limit
        patchWorkspaceInList(workspace, { focus_limit: limit })
        return { before }
      },
      onError: (_e, _v, ctx) => {
        if (ctx?.before) patchWorkspaceInList(workspace, { focus_limit: ctx.before })
      },
    },
    rootClient
  )
}

/** Read the latest goals and limit at call time (for Undo callbacks). */
export function useLimitSnapshot() {
  const qc = useQueryClient()
  const { workspace } = useWorkspace()
  return () => {
    const goals = qc.getQueryData<Goal[]>(goalsKey)
    const ws = rootClient.getQueryData<WorkspaceInfo[]>(workspacesKey)?.find((w) => w.id === workspace)
    return { active: activeOf(goals).length, limit: ws?.focus_limit ?? 3 }
  }
}
