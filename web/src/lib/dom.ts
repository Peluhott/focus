import { useEffect, type RefObject } from 'react'

/** Focus is in a field that takes typing (so single-key shortcuts stay out of the way). */
export const inTextField = (el: Element | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    (el.tagName === 'INPUT' &&
      !['checkbox', 'radio', 'button', 'submit'].includes((el as HTMLInputElement).type)))

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** Close a popup on a pointer press outside `ref` or on Esc (while `open`). */
export function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, ref, close])
}
