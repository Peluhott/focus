import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  TimerIcon,
} from '@phosphor-icons/react'
import { TIMER_START_EVENT } from '../lib/overlays'

/**
 * The nav-bar timer (NAV-AND-TIMER.md). Runs in the browser only; the state
 * lives in localStorage so a reload (or a workspace switch) keeps counting
 * from the stored end time.
 */
type Status = 'idle' | 'running' | 'paused' | 'done'
type TimerState = {
  status: Status
  lengthMin: number
  /** When it ends (ms epoch), while running. */
  endAt: number | null
  /** Time left while paused. */
  remainingMs: number | null
}

const STORAGE = 'focus.timer.v1'
const PRESETS = [5, 10, 15, 25, 45, 60]
const MAX_MIN = 180

const validMinutes = (raw: string) => {
  if (!/^\d{1,3}$/.test(raw.trim())) return null
  const n = Number(raw)
  return n >= 1 && n <= MAX_MIN ? n : null
}

const idle = (lengthMin: number): TimerState => ({ status: 'idle', lengthMin, endAt: null, remainingMs: null })

function load(): TimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE)
    if (!raw) return null
    const s = JSON.parse(raw) as TimerState
    if (!['idle', 'running', 'paused', 'done'].includes(s.status) || !validMinutes(String(s.lengthMin))) return null
    // Ended while the page was closed: show it as done, without the chime.
    if (s.status === 'running' && (!s.endAt || s.endAt <= Date.now())) return { ...s, status: 'done', endAt: null }
    return s
  } catch {
    return null
  }
}

function leftMs(s: TimerState, now: number) {
  if (s.status === 'running') return Math.max(0, (s.endAt ?? now) - now)
  if (s.status === 'paused') return s.remainingMs ?? 0
  if (s.status === 'done') return 0
  return s.lengthMin * 60_000
}

function format(ms: number) {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** Rings of the end-of-timer alarm, and the gap between their starts. */
const RINGS = 3
const RING_GAP_S = 3

/** The alarm that's sounding now, if any (closing it stops the rest of the rings). */
let ringing: AudioContext | null = null

/** Stop the alarm early: the timer was reset, restarted or edited. */
function stopChime() {
  if (!ringing) return
  void ringing.close().catch(() => {})
  ringing = null
}

/**
 * The end-of-timer alarm (Web Audio, no asset): three short 880 Hz beeps,
 * rung RINGS times, RING_GAP_S seconds apart.
 */
function chime() {
  try {
    stopChime()
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ringing = ctx
    for (let ring = 0; ring < RINGS; ring++) {
      for (let i = 0; i < 3; i++) {
        const start = ctx.currentTime + ring * RING_GAP_S + i * 0.32
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.3, start)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3)
        osc.connect(gain).connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.3)
      }
    }
    window.setTimeout(() => ringing === ctx && stopChime(), ((RINGS - 1) * RING_GAP_S + 1.5) * 1000)
  } catch {
    // No audio: the red "done" state still shows.
  }
}

export default function NavTimer({ defaultMinutes }: { defaultMinutes: number | undefined }) {
  const [stored] = useState(load)
  const [state, setState] = useState<TimerState>(() => stored ?? idle(defaultMinutes ?? 25))
  const [now, setNow] = useState(() => Date.now())
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const cancelEdit = useRef(false)
  const [newOpen, setNewOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify(state))
  }, [state])

  // The default length follows Settings while idle. The first value only
  // applies when nothing was stored.
  const prevDefault = useRef<number | undefined>(stored ? defaultMinutes : undefined)
  useEffect(() => {
    if (defaultMinutes === undefined) return
    const prev = prevDefault.current
    prevDefault.current = defaultMinutes
    if (prev === defaultMinutes) return
    if (prev === undefined && stored) return
    setState((s) => (s.status === 'idle' ? idle(defaultMinutes) : s))
  }, [defaultMinutes, stored])

  // Tick every 250 ms while running; re-render once a second.
  useEffect(() => {
    if (state.status !== 'running') return
    const timer = window.setInterval(() => {
      const t = Date.now()
      if ((state.endAt ?? 0) <= t) {
        setState((s) => (s.status === 'running' ? { ...s, status: 'done', endAt: null, remainingMs: null } : s))
        chime()
        return
      }
      setNow((prev) => (Math.floor(prev / 1000) === Math.floor(t / 1000) ? prev : t))
    }, 250)
    return () => window.clearInterval(timer)
  }, [state.status, state.endAt])

  // Leaving "done" (reset, restart, new length) silences the alarm. Not on
  // unmount, so a workspace switch doesn't cut it off.
  useEffect(() => {
    if (state.status !== 'done') stopChime()
  }, [state.status])

  // Close the "New" popover on outside click or Esc.
  useEffect(() => {
    if (!newOpen) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setNewOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setNewOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [newOpen])

  const left = leftMs(state, now)
  const length = state.lengthMin * 60_000
  const elapsed = state.status === 'idle' ? 0 : Math.min(1, (length - left) / length)
  const label = format(left)

  const start = (lengthMin: number) => {
    const at = Date.now()
    setNow(at)
    setState({ status: 'running', lengthMin, endAt: at + lengthMin * 60_000, remainingMs: null })
  }

  function onPlayPause() {
    const at = Date.now()
    setNow(at)
    if (state.status === 'running') {
      setState({ ...state, status: 'paused', endAt: null, remainingMs: Math.max(0, (state.endAt ?? at) - at) })
    } else if (state.status === 'paused') {
      setState({ ...state, status: 'running', endAt: at + (state.remainingMs ?? 0), remainingMs: null })
    } else {
      start(state.lengthMin)
    }
  }

  // Search's "Start the timer" quick action: start (or resume) it.
  const playRef = useRef(onPlayPause)
  playRef.current = onPlayPause
  const statusRef = useRef(state.status)
  statusRef.current = state.status
  useEffect(() => {
    const onStart = () => {
      if (statusRef.current !== 'running') playRef.current()
    }
    window.addEventListener(TIMER_START_EVENT, onStart)
    return () => window.removeEventListener(TIMER_START_EVENT, onStart)
  }, [])

  function commitEdit() {
    setEditing(false)
    if (cancelEdit.current) {
      cancelEdit.current = false
      return
    }
    const minutes = validMinutes(draft)
    // Invalid input reverts silently. This run only; Settings keeps its default.
    if (minutes) setState(idle(minutes))
  }

  function onEditKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') e.currentTarget.blur()
    if (e.key === 'Escape') {
      cancelEdit.current = true
      e.currentTarget.blur()
    }
  }

  const customMinutes = validMinutes(custom)
  const startCustom = () => {
    if (!customMinutes) return
    start(customMinutes)
    setNewOpen(false)
    setCustom('')
  }

  const { status } = state
  const playLabel = status === 'running' ? 'Pause timer' : status === 'paused' ? 'Resume timer' : 'Start timer'

  return (
    <div className={`nav-timer is-${status}`} ref={wrapRef}>
      <div className="nav-timer-row" role="timer">
        <TimerIcon className="nav-timer-icon" size={20} aria-hidden />
        {editing ? (
          <span className="nav-timer-edit">
            <input
              className="nav-timer-input"
              inputMode="numeric"
              maxLength={3}
              aria-label="Minutes"
              autoFocus
              value={draft}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
              onKeyDown={onEditKey}
              onBlur={commitEdit}
            />
            <span className="nav-timer-min">min</span>
          </span>
        ) : (
          <button
            type="button"
            className="nav-timer-time"
            title="Change minutes"
            aria-label={`${label} left. Change minutes`}
            onClick={() => {
              setDraft(String(state.lengthMin))
              setEditing(true)
            }}
          >
            {label}
          </button>
        )}
        {status === 'done' ? (
          <>
            <button className="btn btn-ghost nav-timer-text" onClick={() => start(state.lengthMin)}>
              <ArrowClockwiseIcon size={16} aria-hidden />
              Again
            </button>
            <button
              className="btn btn-ghost nav-timer-text"
              aria-expanded={newOpen}
              onClick={() => setNewOpen((o) => !o)}
            >
              <PlusIcon size={16} aria-hidden />
              New
            </button>
          </>
        ) : (
          <>
            <button
              className="btn btn-ghost btn-icon nav-timer-btn"
              aria-label={playLabel}
              title={playLabel}
              onClick={onPlayPause}
            >
              {status === 'running' ? <PauseIcon size={18} aria-hidden /> : <PlayIcon size={18} aria-hidden />}
            </button>
            <button
              className="btn btn-ghost btn-icon nav-timer-btn nav-timer-reset"
              aria-label="Reset timer"
              title="Reset timer"
              disabled={status === 'idle'}
              onClick={() => setState(idle(state.lengthMin))}
            >
              <ArrowCounterClockwiseIcon size={18} aria-hidden />
            </button>
          </>
        )}
      </div>
      <div className="nav-timer-track" aria-hidden>
        <div className="nav-timer-fill" style={{ width: `${elapsed * 100}%` }} />
      </div>
      {newOpen && (
        <div className="nav-timer-pop" role="dialog" aria-label="New timer">
          <span className="nav-timer-pop-title">New timer</span>
          <div className="nav-timer-presets">
            {PRESETS.map((m) => (
              <button
                key={m}
                className={`btn ${m === state.lengthMin ? 'btn-secondary' : 'btn-ghost'} nav-timer-preset`}
                onClick={() => {
                  start(m)
                  setNewOpen(false)
                }}
              >
                {m} min
              </button>
            ))}
          </div>
          <div className="nav-timer-custom">
            <input
              className="input"
              type="number"
              min={1}
              max={MAX_MIN}
              placeholder="Minutes"
              aria-label="Custom minutes"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startCustom()}
            />
            <button className="btn btn-primary" disabled={!customMinutes} onClick={startCustom}>
              Start
            </button>
            <button className="btn btn-ghost" onClick={() => setNewOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
