import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { del, fetchAll, patch, post } from './api'
import { errorMessage, reorder, useOptimisticMutation } from './optimistic'
import { useToast } from './toast'
import { deferDelete, useVisible } from './pendingDeletes'
import type { Note, Placement } from './types'

/** Notes (NOTES.md). One list per workspace, in your order. */
export const notesKey = ['notes'] as const
const key = () => notesKey

export function useNotes() {
  const select = useVisible<Note>('note')
  return useQuery({ queryKey: notesKey, queryFn: () => fetchAll<Note>('/notes'), select })
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

/** Delete with Undo (UNDO.md). `onUndo` reselects the note. */
export function useDeleteNote() {
  const qc = useQueryClient()
  return (note: Note, onUndo?: () => void) =>
    deferDelete(qc, {
      kind: 'note',
      id: note.id,
      title: note.title || 'Untitled note',
      lists: [notesKey],
      commit: () => del(`/notes/${note.id}`),
      afterUndo: onUndo,
    })
}
