import { useEffect, useRef } from 'react'

export type ConfirmRequest = {
  title: string
  body: string
  action: string
  run: () => void
}

/** Confirmation dialog (README "Shared components"). Esc or backdrop cancels. */
export default function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!request) return
    const previous = document.activeElement as HTMLElement | null
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [request, onClose])

  if (!request) return null
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body">
        <div className="dialog-title" id="confirm-title">
          {request.title}
        </div>
        <div className="dialog-body" id="confirm-body">
          {request.body}
        </div>
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            className="btn btn-primary"
            onClick={() => {
              request.run()
              onClose()
            }}
          >
            {request.action}
          </button>
        </div>
      </div>
    </div>
  )
}
