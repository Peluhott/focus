import type { CSSProperties } from 'react'
import {
  CheckCircleIcon,
  CircleIcon,
  FlagPennantIcon,
  PersonSimpleHikeIcon,
  TargetIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import { climbState, fmtN, PEAKS } from '../lib/climb'
import type { CompletionStats } from '../lib/stats'
import type { Goal } from '../lib/types'

/**
 * "Focus so far" (README §2): all-time completed to-dos by goal, and the
 * climb, a leveled mountain the count walks up.
 */
export default function FocusTracker({
  stats,
  activeGoals,
  aiOn,
}: {
  stats: CompletionStats | undefined
  activeGoals: Goal[]
  aiOn: boolean
}) {
  const total = stats?.total ?? 0
  const base = Math.max(total, 1)
  const countFor = (id: number) => stats?.by_goal.find((g) => g.goal_id === id)?.count ?? 0
  const rows = [
    ...activeGoals.map((g) => ({
      key: `g${g.id}`,
      label: g.title || 'Untitled goal',
      count: countFor(g.id),
      offGoal: false,
    })),
    { key: 'off', label: 'Off-goal', count: stats?.off_goal ?? 0, offGoal: true },
  ]
  const climb = climbState(total)

  return (
    <section className="tracker" aria-labelledby="tracker-title" data-screen-label="Focus tracker">
      <h2 id="tracker-title" className="tracker-title">
        Focus so far
      </h2>
      <p className="tracker-sub">All time</p>
      {!aiOn && (
        <p className="hint" style={{ marginTop: 'var(--space-3)' }}>
          The AI check is off, so new completions aren't being counted.
        </p>
      )}

      <div className="tracker-cols">
        <div>
          <h6 className="tracker-h6">Completed to-dos by goal · {fmtN(total)}</h6>
          <div className="share-list">
            {rows.map((r) => (
              <div key={r.key}>
                <div className="share-head">
                  <span className="share-label">
                    {r.offGoal ? (
                      <WarningIcon className="share-icon off" aria-hidden />
                    ) : (
                      <TargetIcon className="share-icon" aria-hidden />
                    )}
                    <span className="share-name">{r.label}</span>
                  </span>
                  <span className="share-count">{fmtN(r.count)}</span>
                </div>
                <div className="share-track">
                  <div
                    className={`share-fill${r.offGoal ? ' off' : ''}`}
                    style={{ width: `${Math.round((r.count / base) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h6 className="tracker-h6">
            The climb · Level {climb.level + 1} · summit at {fmtN(climb.peak)}
          </h6>
          <div className="climb-count">
            <span className="climb-number">{fmtN(total)}</span>
            <span className="climb-sentence">{climb.sentence}</span>
          </div>
          <div className="climb-row">
            <Mountain climb={climb} />
            <Ladder count={total} level={climb.level} levelsPassed={climb.levelsPassed} />
          </div>
        </div>
      </div>
    </section>
  )
}

type Point = [number, number]
const W = 400
const H = 240
const px = (x: number) => `${((x / W) * 100).toFixed(2)}%`
const py = (y: number) => `${((y / H) * 100).toFixed(2)}%`
const P = (p: Point) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`
const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
/** A 9px circle as a path, so all dots of one kind share an element. */
const dot = (p: Point) =>
  `M${(p[0] - 4.5).toFixed(1)} ${p[1].toFixed(1)}a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0`

/** Switchback points 0–5 up the face: y = 222 − 40i, alternating sides. */
const halfWidth = (y: number) => ((y - 16) / 216) * 190
const LEGS: Point[] = [0, 1, 2, 3, 4, 5].map((i) => {
  const y = 222 - i * 40
  return [i === 5 ? 200 : 200 + (i % 2 ? 1 : -1) * halfWidth(y) * 0.72, y]
})
const STEPS = [1, 2, 3, 4]

function Mountain({ climb }: { climb: ReturnType<typeof climbState> }) {
  const { c, step, leg, t, peak } = climb
  const here = lerp(LEGS[leg], LEGS[leg + 1], t)
  const walked = [...LEGS.slice(0, leg + 1), here].map(P).join(' ')
  const ahead = [here, ...LEGS.slice(leg + 1)].map(P).join(' ')
  const reached = (v: number) => c >= v
  const at = (p: Point): CSSProperties => ({ left: px(p[0]), top: py(p[1]) })

  return (
    <div className="mountain">
      <div className="mountain-inner">
        <svg viewBox={`0 0 ${W} ${H}`} className="mountain-svg" aria-hidden>
          <polygon className="mountain-face" points="10,232 104,124 122,116 200,16 262,92 276,98 390,232" />
          <polyline className="trail-ahead" points={ahead} />
          <polyline className="trail-done" points={walked} />
          <path
            className="step-dot"
            d={STEPS.filter((k) => !reached(k * step)).map((k) => dot(LEGS[k])).join('')}
          />
          <path
            className="step-dot done"
            d={STEPS.filter((k) => reached(k * step)).map((k) => dot(LEGS[k])).join('')}
          />
        </svg>
        {STEPS.map((k) => (
          <span
            key={k}
            className={`step-label${reached(k * step) ? ' reached' : ''}`}
            style={{
              ...at(LEGS[k]),
              transform: k % 2 ? 'translate(12px, -50%)' : 'translate(calc(-100% - 12px), -50%)',
            }}
          >
            {fmtN(k * step)}
          </span>
        ))}
        <FlagPennantIcon className="summit-flag" style={at(LEGS[5])} aria-hidden />
        <span className={`summit-label${reached(peak) ? ' reached' : ''}`} style={at(LEGS[5])}>
          Summit · {fmtN(peak)}
        </span>
        <PersonSimpleHikeIcon className="hiker" style={at(here)} aria-label="You are here" />
      </div>
    </div>
  )
}

function Ladder({ count, level, levelsPassed }: { count: number; level: number; levelsPassed: number }) {
  return (
    <div className="ladder" aria-label="Levels">
      <div className="ladder-head">
        <span className="ladder-number">{levelsPassed}</span>
        <span className="ladder-caption">{levelsPassed === 1 ? 'level passed' : 'levels passed'}</span>
      </div>
      <ol className="ladder-list" reversed>
        {PEAKS.map((peak, i) => {
          const passed = count >= peak
          const current = i === level && !passed
          const state = passed ? 'passed' : current ? 'current' : 'ahead'
          return (
            <li key={peak} className={`ladder-row ${state}`} aria-current={current ? 'step' : undefined}>
              <span className="ladder-mark">
                {passed ? (
                  <CheckCircleIcon aria-hidden />
                ) : current ? (
                  <PersonSimpleHikeIcon aria-hidden />
                ) : (
                  <CircleIcon aria-hidden />
                )}
              </span>
              <span className="ladder-level">Level {i + 1}</span>
              <span className="ladder-peak">{fmtN(peak)}</span>
            </li>
          )
        }).reverse()}
      </ol>
    </div>
  )
}
