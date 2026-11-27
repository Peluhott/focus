import { useSyncExternalStore } from 'react'

/**
 * The toast (UNDO.md, option 1b), as a small store outside React so the
 * delete flow (pendingDeletes.ts) can drive it too. Bottom-left; one at a
 * time.
 * - Deletes stack: a delete while a delete toast shows joins it, and the
 *   timer restarts. The real DELETEs go out when the toast ends.
 * - Any other toast replaces whatever shows. A delete batch it replaces
 *   is committed first.
 * - 10 s when there's an Undo, 5 s otherwise. Hovering pauses the timer.
 */
export type DeleteItem = {
  /** e.g. "todo:12": the same item never joins a batch twice. */
  key: string
  title: string
  /** Put the item back in the caches (where it was). */
  restore: () => void
  /** The real delete; on failure the item is restored. */
  commit: () => Promise<unknown>
  /** Drop the item from view-hiding once it's committed or restored. */
  settle: () => void
}

export type ToastState =
  | { kind: 'info'; id: number; message: string; undo?: () => void; duration: number; paused: boolean }
  | { kind: 'delete'; id: number; items: DeleteItem[]; duration: number; paused: boolean }

const UNDO_MS = 10_000
const INFO_MS = 5_000

let state: ToastState | null = null
let nextId = 1
let timer: number | undefined
let deadline = 0
let remaining = 0
const listeners = new Set<() => void>()

function emit(next: ToastState | null) {
  state = next
  for (const l of listeners) l()
}

function startTimer(ms: number) {
  window.clearTimeout(timer)
  remaining = ms
  deadline = Date.now() + ms
  timer = window.setTimeout(expire, ms)
}

function expire() {
  window.clearTimeout(timer)
  const current = state
  emit(null)
  if (current?.kind === 'delete') commitItems(current.items)
}

/** Send the real deletes. A failure puts the item back and says so. */
function commitItems(items: DeleteItem[]): Promise<void> {
  return Promise.all(
    items.map((item) =>
      item.commit().then(
        () => item.settle(),
        () => {
          item.settle()
          item.restore()
          showToast(`Couldn't delete “${item.title}”. Try again.`)
        }
      )
    )
  ).then(() => undefined)
}

/** Show a toast, optionally with Undo. Replaces whatever shows. */
export function showToast(message: string, undo?: () => void) {
  const current = state
  const duration = undo ? UNDO_MS : INFO_MS
  emit({ kind: 'info', id: nextId++, message, undo, duration, paused: false })
  startTimer(duration)
  if (current?.kind === 'delete') commitItems(current.items)
}

/** A delete with Undo: joins the delete toast that's showing, or starts one. */
export function showDeleteToast(item: DeleteItem) {
  const items = state?.kind === 'delete' ? state.items.filter((i) => i.key !== item.key) : []
  emit({ kind: 'delete', id: nextId++, items: [...items, item], duration: UNDO_MS, paused: false })
  startTimer(UNDO_MS)
}

/** Undo (or Undo all): restores the batch in reverse order of deletion. */
export function runUndo() {
  const current = state
  if (!current) return false
  if (current.kind === 'info' && !current.undo) return false
  window.clearTimeout(timer)
  emit(null)
  if (current.kind === 'info') {
    current.undo?.()
  } else {
    for (const item of [...current.items].reverse()) {
      item.settle()
      item.restore()
    }
  }
  return true
}

/** Does the toast showing offer Undo (for ⌘Z)? */
export const canUndo = () =>
  state !== null && (state.kind === 'delete' || state.undo !== undefined)

export function pauseToast() {
  if (!state || state.paused) return
  window.clearTimeout(timer)
  remaining = Math.max(0, deadline - Date.now())
  emit({ ...state, paused: true })
}

export function resumeToast() {
  if (!state || !state.paused) return
  emit({ ...state, paused: false })
  startTimer(remaining)
}

export function dismissToast() {
  expire()
}

/**
 * Commit waiting deletes now (workspace switch, sign-out, closing the tab,
 * or before an action that needs them gone, like adding a goal at the
 * limit). With `match`, only those items; the rest keep their Undo.
 */
export function flushDeletes(match?: (key: string) => boolean): Promise<void> {
  if (state?.kind !== 'delete') return Promise.resolve()
  const now = match ? state.items.filter((i) => match(i.key)) : state.items
  if (now.length === 0) return Promise.resolve()
  const rest = state.items.filter((i) => !now.includes(i))
  if (rest.length === 0) {
    window.clearTimeout(timer)
    emit(null)
  } else {
    emit({ ...state, items: rest })
  }
  return commitItems(now)
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const useToastState = () => useSyncExternalStore(subscribe, () => state)

export type ShowToast = (message: string, undo?: () => void) => void

/** Show the toast, optionally with Undo (10 s with Undo, 5 s without). */
export const useToast = (): ShowToast => showToast
