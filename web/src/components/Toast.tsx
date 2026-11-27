import { useEffect, type ReactNode } from 'react'
import {
  canUndo,
  pauseToast,
  resumeToast,
  runUndo,
  useToastState,
} from '../lib/toast'

const inTextField = (el: Element | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    (el.tagName === 'INPUT' &&
      !['checkbox', 'radio', 'button', 'submit'].includes((el as HTMLInputElement).type)))

/**
 * The toast (UNDO.md, option 1b): bottom-left at the page gutter. Deletes
 * stack into one toast ("N items deleted", Undo all); a progress bar drains
 * over its time and pauses while hovered. ⌘Z / Ctrl+Z undoes outside text
 * fields. State lives in lib/toast.ts.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const toast = useToastState()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'z' || !(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
      if (!canUndo() || inTextField(document.activeElement)) return
      e.preventDefault()
      runUndo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  let message: ReactNode = null
  let undoLabel: string | null = null
  if (toast?.kind === 'info') {
    message = <span className="toast-msg">{toast.message}</span>
    if (toast.undo) undoLabel = 'Undo'
  } else if (toast?.kind === 'delete') {
    const n = toast.items.length
    message =
      n === 1 ? (
        <span className="toast-msg">“{toast.items[0].title || 'Untitled'}” deleted</span>
      ) : (
        <span className="toast-msg">
          {n} items deleted
          <span className="toast-list">
            {toast.items.map((i) => i.title || 'Untitled').join(', ')}
          </span>
        </span>
      )
    undoLabel = n === 1 ? 'Undo' : 'Undo all'
  }
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  return (
    <>
      {children}
      {toast && (
        <div
          className={`toast${toast.paused ? ' is-paused' : ''}`}
          role="status"
          key={toast.id}
          onMouseEnter={pauseToast}
          onMouseLeave={resumeToast}
        >
          <div className="toast-row">
            {message}
            {toast.paused && <span className="toast-paused">Paused</span>}
            {undoLabel && (
              <button className="btn btn-ghost toast-undo" onClick={() => runUndo()}>
                {undoLabel}
                <kbd className="toast-kbd">{isMac ? '⌘Z' : 'Ctrl+Z'}</kbd>
              </button>
            )}
          </div>
          <span
            className="toast-bar"
            aria-hidden
            style={{ animationDuration: `${toast.duration}ms` }}
          />
        </div>
      )}
    </>
  )
}
