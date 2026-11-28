import { useCallback, useSyncExternalStore } from 'react'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { setKeepalive } from './api'
import { flushDeletes, showDeleteToast } from './toast'

/**
 * Deletes with Undo (UNDO.md), done as a delayed delete: the item leaves
 * the caches at once and the toast offers Undo for 10 s; only when the
 * toast ends does the real DELETE go out. Undo just puts it back, so it
 * returns with its id, position, links and history intact.
 *
 * While a delete waits, its item is "hidden": list hooks filter it out
 * (`useVisible`), so a refetch in the meantime (alignment polling, another
 * mutation settling) can't bring it back on screen.
 */
export type DeleteKind = 'goal' | 'subgoal' | 'todo' | 'project' | 'task' | 'file' | 'note'

const hidden = new Set<string>()
let version = 0
const listeners = new Set<() => void>()
const bump = () => {
  version++
  for (const l of listeners) l()
}
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const isHidden = (kind: DeleteKind, id: number) => hidden.has(`${kind}:${id}`)

/** A `select` for list queries: drops items whose delete is waiting. */
export function useVisible<T extends { id: number }>(kind: DeleteKind) {
  const v = useSyncExternalStore(subscribe, () => version)
  return useCallback(
    (list: T[]) => (hidden.size === 0 ? list : list.filter((i) => !isHidden(kind, i.id))),
    [kind, v]
  )
}

/** For `select` on caches that aren't plain lists. */
export function useHiddenVersion() {
  return useSyncExternalStore(subscribe, () => version)
}

type Snapshot = { key: QueryKey; index: number; item: unknown }

/** Where the item sits in every cache matching `prefix` (arrays, or `{ data: [] }`). */
function takeFrom(qc: QueryClient, prefix: QueryKey, id: number): Snapshot[] {
  const out: Snapshot[] = []
  for (const [key, data] of qc.getQueriesData<unknown>({ queryKey: prefix })) {
    const list = Array.isArray(data) ? data : (data as { data?: unknown })?.data
    if (!Array.isArray(list)) continue
    const index = list.findIndex((i: { id: number }) => i.id === id)
    if (index < 0) continue
    out.push({ key, index, item: list[index] })
    const next = list.filter((_, i) => i !== index)
    qc.setQueryData(key, Array.isArray(data) ? next : { ...(data as object), data: next })
  }
  return out
}

/** Put it back at the same index, unless a refetch already has it. */
function putBack(qc: QueryClient, snaps: Snapshot[]) {
  for (const { key, index, item } of snaps) {
    qc.setQueryData<unknown>(key, (data: unknown) => {
      if (data === undefined) return data
      const list = (Array.isArray(data) ? data : (data as { data: unknown[] }).data) as {
        id: number
      }[]
      if (list.some((i) => i.id === (item as { id: number }).id)) return data
      const next = [...list]
      next.splice(Math.min(index, next.length), 0, item as { id: number })
      return Array.isArray(data) ? next : { ...(data as object), data: next }
    })
  }
}

export type DeferOptions = {
  kind: DeleteKind
  id: number
  title: string
  /** Cache prefixes the item is listed in (each match is edited). */
  lists?: QueryKey[]
  /** For items nested in another cache (sub-goals): remove, and return how to undo. */
  remove?: () => () => void
  /** The real delete. */
  commit: () => Promise<unknown>
  /** After the delete went through (refetch what depends on it). */
  afterCommit?: () => void
  /** After Undo put it back (e.g. reselect a note). */
  afterUndo?: () => void
}

/** What the toast calls an item with no title (V2-UI-CHANGES §10). */
const UNTITLED: Record<DeleteKind, string> = {
  goal: 'Untitled goal',
  subgoal: 'Sub-goal',
  todo: 'Untitled to-do',
  project: 'Untitled project',
  task: 'Untitled task',
  file: 'Untitled file',
  note: 'Untitled note',
}

/** Delete with Undo: hide now, delete when the toast ends. */
export function deferDelete(qc: QueryClient, opts: DeferOptions) {
  const tag = `${opts.kind}:${opts.id}`
  const snaps = (opts.lists ?? []).flatMap((prefix) => takeFrom(qc, prefix, opts.id))
  const undoNested = opts.remove?.()
  hidden.add(tag)
  bump()
  showDeleteToast({
    key: tag,
    title: opts.title.trim() || UNTITLED[opts.kind],
    restore: () => {
      putBack(qc, snaps)
      undoNested?.()
      opts.afterUndo?.()
    },
    commit: async () => {
      await opts.commit()
      // A refetch while it waited may have brought it back into the raw cache.
      for (const prefix of opts.lists ?? []) takeFrom(qc, prefix, opts.id)
      opts.remove?.()
      opts.afterCommit?.()
    },
    settle: () => {
      hidden.delete(tag)
      bump()
    },
  })
}

/** Commit every waiting delete now (or only those of one kind). */
export function flushPendingDeletes(kind?: DeleteKind): Promise<void> {
  return flushDeletes(kind ? (key) => key.startsWith(`${kind}:`) : undefined)
}

// Closing or reloading the tab sends what's waiting (keepalive requests outlive the page).
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    setKeepalive(true)
    void flushPendingDeletes()
    setKeepalive(false)
  })
}
