import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { del, fetchAll, patch, post } from './api'
import { errorMessage, reorder, useOptimisticMutation } from './optimistic'
import { useToast } from './toast'
import type { Note, Placement } from './types'

/** Notes (NOTES.md). One list per workspace, in your order. */
export const notesKey = ['notes'] as const
const key = () => notesKey

export function useNotes() {
  return useQuery({ queryKey: notesKey, queryFn: () => fetchAll<Note>('/notes') })
}

/** Waits for the server (the editor needs the real id before it can autosave). New notes go on top. */
export function useCreateNote() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    scope: { id: 'notes' },
    mutationKey: ['focus-mutation'],
    mutationFn: () => post<Note>('/notes', { title: '', body: '' }),
    onSuccess: (note) => qc.setQueryData<Note[]>(notesKey, (old) => [note, ...(old ?? [])]),
    onError: (error) => toast(errorMessage(error)),
  })
}

/**
 * Autosave. The editor keeps its own draft, so the server's answer only
 * bumps updated_at (it never overwrites text typed while the save was out).
 */
export function useUpdateNote() {
  return useOptimisticMutation<Note, { id: number; patch: Partial<Pick<Note, 'title' | 'body'>> }, Note[]>({
    scope: 'notes',
    queryKey: key,
    mutationFn: ({ id, patch: body }) => patch<Note>(`/notes/${id}`, body),
    apply: (old, { id, patch: body }) =>
      old.map((n) => (n.id === id ? { ...n, ...body, updated_at: new Date().toISOString() } : n)),
    settle: (old, saved) => old.map((n) => (n.id === saved.id ? { ...n, updated_at: saved.updated_at } : n)),
  })
}

export function useMoveNote() {
  return useOptimisticMutation<Note, { id: number; placement: Placement; order: Note[] }, Note[]>({
    scope: 'notes',
    queryKey: key,
    mutationFn: ({ id, placement }) => patch<Note>(`/notes/${id}`, placement),
    apply: (old, { order }) => reorder(old, order),
  })
}

export function useDeleteNote() {
  return useOptimisticMutation<void, { id: number }, Note[]>({
    scope: 'notes',
    queryKey: key,
    mutationFn: ({ id }) => del(`/notes/${id}`),
    apply: (old, { id }) => old.filter((n) => n.id !== id),
  })
}

/** Undo a delete: re-create it between the same neighbours (it gets a new id). */
export function useRestoreNote() {
  return useOptimisticMutation<
    Note,
    { note: Note; index: number; tempId: number; placement: Placement | null },
    Note[]
  >({
    scope: 'notes',
    queryKey: key,
    mutationFn: ({ note, placement }) =>
      post<Note>('/notes', { title: note.title, body: note.body, ...(placement ?? {}) }),
    apply: (old, { note, index, tempId }) => {
      const next = old.filter((n) => n.id !== note.id)
      next.splice(Math.min(index, next.length), 0, { ...note, id: tempId })
      return next
    },
    settle: (old, saved, { tempId }) => old.map((n) => (n.id === tempId ? saved : n)),
  })
}
