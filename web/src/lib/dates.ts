/** Dates are calendar days ("YYYY-MM-DD"), compared in the viewer's local time. */

export function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const short = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

/** "2026-11-21" → "Nov 21" */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return short.format(new Date(y, m - 1, d))
}

export function isOverdue(iso: string): boolean {
  return iso < todayISO()
}

/** A timestamp ("2026-11-21T15:04:05Z") → "Nov 21", in the viewer's local time. */
export function shortDay(timestamp: string): string {
  return short.format(new Date(timestamp))
}

const shortWithYear = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** A timestamp → "Nov 12", or "Nov 12, 2025" when it's not this year. */
export function shortDayMaybeYear(timestamp: string): string {
  const d = new Date(timestamp)
  return d.getFullYear() === new Date().getFullYear() ? short.format(d) : shortWithYear.format(d)
}
