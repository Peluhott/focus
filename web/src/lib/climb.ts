/**
 * "The climb" (README §2, Focus tracker): all-time completed to-dos turned
 * into progress up a series of mountains. Each level is one mountain with
 * five equal steps (peak / 5). The count is cumulative: the current level is
 * the first peak above the count, and steps are measured from 0.
 */
export const PEAKS = [100, 500, 1000, 5000, 10000, 50000, 100000] as const
/** Camp names by step; 0 is the trailhead. */
export const CAMPS = ['Trailhead', 'Meadow', 'Tree line', 'Ridge', 'False summit', 'Summit'] as const
const TOP = PEAKS[PEAKS.length - 1]

export const fmtN = (n: number) => n.toLocaleString('en-US')

export function levelOf(count: number) {
  const i = PEAKS.findIndex((p) => count < p)
  return i < 0 ? PEAKS.length - 1 : i
}

export type ClimbState = {
  count: number
  /** 0-based level index. */
  level: number
  peak: number
  step: number
  /** min(count, peak) */
  c: number
  /** Current leg 0–4 and how far along it (0–1). */
  leg: number
  t: number
  levelsPassed: number
  atTop: boolean
  /** The sentence after the big number. */
  sentence: string
}

export function climbState(count: number): ClimbState {
  const level = levelOf(count)
  const peak = PEAKS[level]
  const step = peak / 5
  const c = Math.min(count, peak)
  const atTop = count >= TOP
  const leg = Math.min(4, Math.floor(c / step))
  const t = atTop ? 1 : (c % step) / step
  const levelsPassed = PEAKS.filter((p) => count >= p).length
  const nextIdx = Math.min(5, Math.floor(c / step) + 1)
  const toGo = nextIdx * step - count
  const sentence = atTop
    ? 'completed. You topped every level.'
    : nextIdx === 5
      ? `completed · ${fmtN(toGo)} to the summit`
      : `completed · ${fmtN(toGo)} to the ${CAMPS[nextIdx].toLowerCase()} at ${fmtN(nextIdx * step)}`
  return { count, level, peak, step, c, leg, t, levelsPassed, atTop, sentence }
}

/**
 * The milestone sentence when a completion crosses a camp or peak, e.g.
 * "You reached the ridge at 600." or "You topped level 2 at 500.", else null.
 */
export function milestoneSentence(before: number, after: number): string | null {
  if (after <= before || before >= TOP) return null
  const lb = levelOf(before)
  const la = levelOf(after)
  if (la > lb || after >= TOP) return `You topped level ${lb + 1} at ${fmtN(PEAKS[lb])}.`
  const stepA = PEAKS[la] / 5
  if (Math.floor(after / stepA) > Math.floor(before / stepA)) {
    const k = Math.floor(after / stepA)
    return `You reached the ${CAMPS[k].toLowerCase()} at ${fmtN(k * stepA)}.`
  }
  return null
}

/** The completion toast, given the climb count before and after. */
export function completionToast(before: number, after: number) {
  const milestone = milestoneSentence(before, after)
  return milestone ? `To-do completed. ${milestone}` : 'To-do completed'
}
