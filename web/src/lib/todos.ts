import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { del, fetchAll, patch, post } from './api'
import { isTemp, useOptimisticMutation } from './optimistic'
import { useAiOn } from './settings'
import type { LinkTarget, Placement, Todo } from './types'

export const todosKey = ['todos'] as const
const key = () => todosKey

/** Open to-dos, in your order. */
export function useTodos() {
  return useQuery({ queryKey: todosKey, queryFn: () => fetchAll<Todo>('/todos') })
}

export function useAddTodo() {
  return useOptimisticMutation<Todo, { tempId: number; title: string }, Todo[]>({
    scope: 'todos',
    queryKey: key,
    mutationFn: ({ title }) => post<Todo>('/todos', { title }),
    apply: (old, { tempId, title }) => [
      {
        id: tempId,
        title,
        notes: '',
        date: null,
        position: '',
        done: false,
        done_at: null,
        alignment_status: null,
        alignment_reason: null,
        alignment_source: null,
        matched_goal_id: null,
        matched_project_id: null,
      },
      ...old,
    ],
    settle: (old, todo, { tempId }) => old.map((t) => (t.id === tempId ? todo : t)),
  })
}

export type TodoPatch = Partial<Pick<Todo, 'title' | 'notes' | 'date'>>

/** The AI result is cleared while a check runs (spec: "nothing while checking"). */
const CHECKING = {
  alignment_status: 'pending',
  alignment_reason: null,
  alignment_source: null,
  matched_goal_id: null,
  matched_project_id: null,
  matched_goal: null,
} as const

export function useUpdateTodo() {
  const aiOn = useAiOn()
  return useOptimisticMutation<Todo, { id: number; patch: TodoPatch }, Todo[]>({
    scope: 'todos',
    queryKey: key,
    mutationFn: ({ id, patch: body }) => patch<Todo>(`/todos/${id}`, body),
    apply: (old, { id, patch: body }) =>
      old.map((t) => {
        if (t.id !== id) return t
        // New text re-runs the check, unless the to-do is linked by hand.
        const recheck =
          aiOn &&
          t.alignment_source !== 'manual' &&
          ((body.title !== undefined && body.title !== t.title) ||
            (body.notes !== undefined && body.notes !== t.notes))
        return { ...t, ...body, ...(recheck ? CHECKING : {}) }
      }),
  })
}

/** "This is fine": the flag goes away until the text changes. */
export function useDismissTodo() {
  return useOptimisticMutation<Todo, { id: number }, Todo[]>({
    scope: 'todos',
    queryKey: key,
    mutationFn: ({ id }) => post<Todo>(`/todos/${id}/dismiss`),
    apply: (old, { id }) =>
      old.map((t) =>
        t.id === id ? { ...t, alignment_status: 'dismissed', alignment_reason: null } : t
      ),
  })
}

/** Ask the AI again (the "retry" link after an error). */
export function useRecheckTodo() {
  return useOptimisticMutation<Todo, { id: number }, Todo[]>({
    scope: 'todos',
    queryKey: key,
    mutationFn: ({ id }) => post<Todo>(`/todos/${id}/recheck`),
    apply: (old, { id }) => old.map((t) => (t.id === id ? { ...t, ...CHECKING } : t)),
  })
}

/**
 * "Link to…": pin a to-do to a goal by hand; the AI never overwrites it.
 * `target: null` removes the link and hands it back to the AI.
 */
export function useLinkTodo() {
  const aiOn = useAiOn()
  return useOptimisticMutation<Todo, { id: number; target: LinkTarget | null }, Todo[]>({
    scope: 'todos',
    queryKey: key,
    mutationFn: ({ id, target }) =>
      patch<Todo>(`/todos/${id}`, { matched_goal_id: target?.id ?? null }),
    apply: (old, { id, target }) =>
      old.map((t) => {
        if (t.id !== id) return t
        if (!target) {
          return aiOn
            ? { ...t, ...CHECKING }
            : { ...t, ...CHECKING, alignment_status: null }
        }
        return {
          ...t,
          alignment_status: 'aligned',
          alignment_source: 'manual',
          alignment_reason: null,
          matched_goal_id: target.id,
          matched_project_id: null,
          matched_goal: { id: target.id, title: target.title },
        }
      }),
  })
}

/**
 * While the AI is on, refresh the list so results show up: every 2 s while
 * any to-do is being checked, every 15 s otherwise (goal edits re-check in
 * the background). Skips a beat while you're editing, so a refresh never
 * lands between your change and the server's answer.
 */
export function useAlignmentPolling(todos: Todo[] | undefined) {
  const aiOn = useAiOn()
  const qc = useQueryClient()
  const anyPending = !!todos?.some((t) => t.alignment_status === 'pending')
  useEffect(() => {
    if (!aiOn) return
    const timer = setInterval(
      () => {
        if (document.hidden) return
        if (qc.isMutating({ mutationKey: ['focus-mutation'] }) > 0) return
        qc.invalidateQueries({ queryKey: todosKey })
      },
      anyPending ? 2_000 : 15_000
    )
    return () => clearInterval(timer)
  }, [aiOn, anyPending, qc])
}

/** Check it off: it leaves the list (Undo puts it back with useReopenTodo). */
export function useCompleteTodo() {
  return useOptimisticMutation<Todo, { id: number }, Todo[]>({
    scope: 'todos',
    queryKey: key,
    mutationFn: ({ id }) => patch<Todo>(`/todos/${id}`, { done: true }),
    apply: (old, { id }) => old.filter((t) => t.id !== id),
  })
}

export function useReopenTodo() {
  return useOptimisticMutation<Todo, { todo: Todo; index: number }, Todo[]>({
    scope: 'todos',
    queryKey: key,
    mutationFn: ({ todo }) => patch<Todo>(`/todos/${todo.id}`, { done: false }),
    apply: (old, { todo, index }) => {
      const next = old.filter((t) => t.id !== todo.id)
      next.splice(Math.min(index, next.length), 0, todo)
      return next
    },
  })
}

export function useMoveTodo() {
  return useOptimisticMutation<Todo, { id: number; placement: Placement; order: Todo[] }, Todo[]>({
    scope: 'todos',
    queryKey: key,
    mutationFn: ({ id, placement }) => patch<Todo>(`/todos/${id}`, placement),
    apply: (_old, { order }) => order,
  })
}

/**
 * Undo a delete: re-create the to-do and put it back between the same
 * neighbours (it gets a new id; done state and manual links aren't kept).
 */
export function useRestoreTodo() {
  return useOptimisticMutation<
    Todo,
    { todo: Todo; index: number; tempId: number; placement: Placement | null },
    Todo[]
  >({
    scope: 'todos',
    queryKey: key,
    mutationFn: async ({ todo, placement }) => {
      const created = await post<Todo>('/todos', { title: todo.title, notes: todo.notes, date: todo.date })
      return placement ? patch<Todo>(`/todos/${created.id}`, placement) : created
    },
    apply: (old, { todo, index, tempId }) => {
      const next = old.filter((t) => t.id !== todo.id)
      next.splice(Math.min(index, next.length), 0, { ...todo, id: tempId })
      return next
    },
    settle: (old, saved, { tempId }) => old.map((t) => (t.id === tempId ? saved : t)),
  })
}

export function useDeleteTodo() {
  return useOptimisticMutation<void, { id: number }, Todo[]>({
    scope: 'todos',
    queryKey: key,
    mutationFn: ({ id }) => (isTemp(id) ? Promise.resolve() : del(`/todos/${id}`)),
    apply: (old, { id }) => old.filter((t) => t.id !== id),
  })
}
