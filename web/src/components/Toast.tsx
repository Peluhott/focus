import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ShowToast } from '../lib/toast'

type Toast = { id: number; message: string; undo?: () => void }

/**
 * Undo toast (README "Shared components"): bottom-left at the page gutter,
 * auto-dismisses after 5 s. A new toast replaces the current one.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const nextId = useRef(1)

  const show = useCallback<ShowToast>((message, undo) => {
    window.clearTimeout(timer.current)
    setToast({ id: nextId.current++, message, undo })
    timer.current = window.setTimeout(() => setToast(null), 5000)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                window.clearTimeout(timer.current)
                setToast(null)
                toast.undo?.()
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}
