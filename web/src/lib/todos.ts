import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { del, fetchAll, patch, post } from './api'
import { isTemp, useOptimisticMutation } from './optimistic'
import { deferDelete, useVisible } from './pendingDeletes'
import { useAiOn } from './settings'
import { offTrackKey } from './backlog'
import { bumpDoneToday, bumpStats, doneTodayKey, goalIdsOf, statsKey } from './stats'
import type { LinkTarget, Placement, Todo } from './types'

export const todosKey = ['todos'] as const
const key = () => todosKey

/** Open to-dos, in your order. */
export function useTodos() {
  const select = useVisible<Todo>('todo')
  return useQuery({ queryKey: todosKey, queryFn: () => fetchAll<Todo>('/todos'), select })
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
        matches: [],
        match_level: 'none',
        recurring: false,
        completion_count: 0,
        last_completed_at: null,
      },
      ...old,
    ],
    settle: (old, todo, { tempId }) => old.map((t) => (t.id === tempId ? todo : t)),
  })
}

export type TodoPatch = Partial<Pick<Todo, 'title' | 'notes' | 'date' | 'recurring'>>

/** The AI result is cleared while a check runs (spec: "nothing while checking"). */
const CHECKING: Pick<
  Todo,
  'alignment_status' | 'alignment_reason' | 'alignment_source' | 'matches' | 'match_level'
> = {
  alignment_status: 'pending',
  alignment_reason: null,
  alignment_source: null,
  matches: [],
  match_level: 'none',
}

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
        // Repeat on: the date goes (repeating to-dos have no date).
        const date = body.recurring ? { date: null } : {}
        return { ...t, ...body, ...date, ...(recheck ? CHECKING : {}) }
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
        t.id === id
          ? { ...t, alignment_status: 'dismissed', alignment_reason: null, matches: [], match_level: 'none' }
          : t
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
          matches: [{ type: 'goal', id: target.id, title: target.title, confidence: null }],
          // The server works out the level from the number of active goals.
          match_level: t.match_level === 'none' ? 'one' : t.match_level,
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
/**
 * A red (unaligned) to-do that's checked off goes to the off-track backlog
 * instead of being completed. Same rule as the server: AI on and red.
 */
export const goesOffTrack = (todo: Todo, aiOn: boolean) =>
  aiOn && todo.alignment_status === 'unaligned'

/**
 * Check it off. With the AI on, a completion counts toward the climb
 * ("Focus so far"); a red to-do moves to the off-track backlog instead.
 */
export function useCompleteTodo() {
  const aiOn = useAiOn()
  return useOptimisticMutation<Todo, { todo: Todo }, Todo[]>({
    scope: 'todos',
    queryKey: key,
    mutationFn: ({ todo }) => patch<Todo>(`/todos/${todo.id}`, { done: true }),
    apply: (old, { todo }) => old.filter((t) => t.id !== todo.id),
    alsoApply: (qc, { todo }) => {
      if (aiOn && !goesOffTrack(todo, aiOn)) bumpStats(qc, goalIdsOf(todo), 1)
    },
    // "Done today" already went up on the tick (TodoRow).
    alsoInvalidate: () => [statsKey, offTrackKey, doneTodayKey],
  })
}

/**
 * Undo a check-off. A recurring to-do that went off-track comes back as
 * recurring (it stopped repeating when it moved).
 */
export function useReopenTodo() {
  const aiOn = useAiOn()
  return useOptimisticMutation<Todo, { todo: Todo; index: number }, Todo[]>({
    scope: 'todos',
    queryKey: key,
    mutationFn: ({ todo }) =>
      patch<Todo>(`/todos/${todo.id}`, todo.recurring ? { done: false, recurring: true } : { done: false }),
    apply: (old, { todo, index }) => {
      const next = old.filter((t) => t.id !== todo.id)
      next.splice(Math.min(index, next.length), 0, todo)
      return next
    },
    alsoApply: (qc, { todo }) => {
      if (aiOn && !goesOffTrack(todo, aiOn)) bumpStats(qc, goalIdsOf(todo), -1)
      if (!goesOffTrack(todo, aiOn)) bumpDoneToday(qc, -1)
    },
    alsoInvalidate: () => [statsKey, offTrackKey, doneTodayKey],
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
 * Delete with Undo (UNDO.md): gone now, sent when the toast ends. Undo
 * puts the same to-do back where it was.
 */
export function useDeleteTodo() {
  const qc = useQueryClient()
  return (todo: Todo) => {
    if (isTemp(todo.id)) {
      qc.setQueryData<Todo[]>(todosKey, (old) => old?.filter((t) => t.id !== todo.id))
      return
    }
    deferDelete(qc, {
      kind: 'todo',
      id: todo.id,
      title: todo.title,
      lists: [todosKey],
      commit: () => del(`/todos/${todo.id}`),
      afterCommit: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
    })
  }
}

/** Local "YYYY-MM-DD" of a timestamp, to compare with today. */
const localDay = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "✓ today": a recurring to-do checked off today (local date). */
export const doneToday = (todo: Todo, today: string) =>
  !!todo.last_completed_at && localDay(todo.last_completed_at) === today

/**
 * Check off a recurring to-do: logs one completion and leaves it in place.
 * The count, "✓ today" and the climb update at once; the response carries
 * completion_id for Undo.
 */
export function useLogCompletion() {
  const aiOn = useAiOn()
  return useOptimisticMutation<Todo, { todo: Todo }, Todo[]>({
    scope: 'todos',
    queryKey: key,
    mutationFn: ({ todo }) => patch<Todo>(`/todos/${todo.id}`, { done: true }),
    apply: (old, { todo }) =>
      old.map((t) =>
        t.id === todo.id
          ? { ...t, completion_count: t.completion_count + 1, last_completed_at: new Date().toISOString() }
          : t
      ),
    settle: (old, saved) => old.map((t) => (t.id === saved.id ? { ...t, ...saved } : t)),
    alsoApply: (qc, { todo }) => {
      if (aiOn) bumpStats(qc, goalIdsOf(todo), 1)
      bumpDoneToday(qc, 1)
    },
    alsoInvalidate: () => [statsKey, doneTodayKey],
  })
}

/** Undo a recurring check-off: DELETE /completions/:id and restore the row. */
export function useUndoCompletion() {
  const aiOn = useAiOn()
  return useOptimisticMutation<void, { todo: Todo; completionId: number }, Todo[]>({
    scope: 'todos',
    queryKey: key,
    mutationFn: ({ completionId }) => del(`/completions/${completionId}`),
    apply: (old, { todo }) =>
      old.map((t) =>
        t.id === todo.id
          ? { ...t, completion_count: todo.completion_count, last_completed_at: todo.last_completed_at }
          : t
      ),
    alsoApply: (qc, { todo }) => {
      if (aiOn) bumpStats(qc, goalIdsOf(todo), -1)
      bumpDoneToday(qc, -1)
    },
    alsoInvalidate: () => [statsKey, doneTodayKey],
  })
}
