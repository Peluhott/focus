import { useSyncExternalStore } from 'react'

/**
 * Which app-wide popup is open: the search palette (SEARCH.md) or the
 * feedback form (FEEDBACK.md). Only one at a time; opening search closes
 * feedback. Also the "Start the timer" quick action's signal to NavTimer.
 */
type Overlay = 'search' | 'feedback' | null

let open: Overlay = null
const listeners = new Set<() => void>()
const set = (next: Overlay) => {
  open = next
  for (const l of listeners) l()
}
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const useOverlay = () => useSyncExternalStore(subscribe, () => open)
export const openSearch = () => set('search')
export const openFeedback = () => set('feedback')
export const closeOverlay = () => set(null)

/** Search's "Start the timer": NavTimer listens for this. */
export const TIMER_START_EVENT = 'focus:timer-start'
export const startTimer = () => window.dispatchEvent(new Event(TIMER_START_EVENT))
