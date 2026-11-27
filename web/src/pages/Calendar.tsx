import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { CaretLeftIcon, CaretRightIcon, CheckSquareIcon } from '@phosphor-icons/react'
import { useCalendar } from '../lib/calendar'
import { todayISO } from '../lib/dates'
import type { CalendarEntry } from '../lib/types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** Items shown in a day cell before "+N more". */
const PER_DAY = 3
/** Below this width the grid is too cramped: show a list of days instead. */
const GRID_MIN_WIDTH = 720

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const longDay = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Calendar (docs "Calendar view"): one month, Sunday to Saturday, with
 * every open dated to-do on its day. Opens on the current month; ‹ › step
 * through months and "Today" jumps back. Read-only; a to-do opens on the
 * To-dos page. No AI state.
 */
export default function Calendar() {
  // Plain calendar dates in local time, fixed for this visit.
  const [today] = useState(todayISO)
  const [ty, tm] = today.split('-').map(Number)
  const thisMonth = ty * 12 + tm - 1
  // The month shown, as a count of months (year * 12 + month index).
  const [shown, setShown] = useState(thisMonth)
  const y = Math.floor(shown / 12)
  const m = (shown % 12) + 1
  const month = `${y}-${pad(m)}`
  const { data: entries, isPending, isError } = useCalendar(month)

  const ref = useRef<HTMLElement>(null)
  const wide = useWidthAtLeast(ref, GRID_MIN_WIDTH)

  const byDay = new Map<string, CalendarEntry[]>()
  for (const e of entries ?? []) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e])
  const total = entries?.length ?? 0
  const overdue = (entries ?? []).filter((e) => e.date < today).length

  const first = new Date(y, m - 1, 1)
  const monthName = first.toLocaleString('en-US', { month: 'long' })

  return (
    <section ref={ref} className="calendar" data-screen-label="Calendar">
      <header className="cal-header">
        <div className="cal-nav">
          <button
            className="btn btn-ghost btn-icon cal-nav-btn"
            aria-label="Previous month"
            onClick={() => setShown((s) => s - 1)}
          >
            <CaretLeftIcon size={22} aria-hidden />
          </button>
          <h1 className="cal-title" aria-live="polite">
            {monthName} <span className="cal-year">{y}</span>
          </h1>
          <button
            className="btn btn-ghost btn-icon cal-nav-btn"
            aria-label="Next month"
            onClick={() => setShown((s) => s + 1)}
          >
            <CaretRightIcon size={22} aria-hidden />
          </button>
        </div>
        {shown !== thisMonth && (
          <button className="btn btn-ghost cal-today-btn" onClick={() => setShown(thisMonth)}>
            Today
          </button>
        )}
        <p className="cal-summary">
          {isPending ? (
            ' '
          ) : (
            <span>{total ? `${plural(total, 'item', 'items')} due in ${monthName}` : `Nothing due in ${monthName}`}</span>
          )}
          {overdue > 0 && <span className="cal-overdue">{overdue} overdue</span>}
        </p>
      </header>

      {isError && <p className="muted centered">Couldn't load the calendar.</p>}
      {entries &&
        (wide ? (
          <MonthGrid first={first} today={today} byDay={byDay} />
        ) : (
          <Agenda first={first} today={today} byDay={byDay} />
        ))}
      {entries && !wide && total === 0 && <p className="muted centered cal-empty">Nothing due in {monthName}.</p>}
    </section>
  )
}

/** Measure the section itself on every resize, never just once at mount. */
function useWidthAtLeast(ref: RefObject<HTMLElement | null>, min: number) {
  const [wide, setWide] = useState(() => window.innerWidth >= min)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWide(el.getBoundingClientRect().width >= min)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, min])
  return wide
}

type DayProps = { first: Date; today: string; byDay: Map<string, CalendarEntry[]> }

function MonthGrid({ first, today, byDay }: DayProps) {
  // Whole weeks: start on the Sunday on or before the 1st, end on the
  // Saturday on or after the last day (5 or 6 rows).
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay())
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + (6 - last.getDay()))
  const days: Date[] = []
  for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    days.push(d)
  }

  return (
    <div className="cal-grid">
      {WEEKDAYS.map((w) => (
        <h6 key={w} className="cal-weekday" aria-hidden>
          {w}
        </h6>
      ))}
      {days.map((d) => {
        const key = iso(d)
        const inMonth = d.getMonth() === first.getMonth()
        const items = inMonth ? (byDay.get(key) ?? []) : []
        const isToday = key === today
        return (
          <div
            key={key}
            role="group"
            className={`cal-cell${inMonth ? '' : ' other'}${isToday ? ' today' : ''}`}
            aria-label={
              inMonth ? `${longDay.format(d)}, ${plural(items.length, 'item', 'items')}` : undefined
            }
            aria-current={isToday ? 'date' : undefined}
            aria-hidden={inMonth ? undefined : true}
          >
            <span className="cal-num">{d.getDate()}</span>
            {items.slice(0, PER_DAY).map((e) => (
              <Item key={e.id} entry={e} today={today} />
            ))}
            {items.length > PER_DAY && (
              <MoreItems day={d} items={items} today={today} hidden={items.length - PER_DAY} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/** "+N more": a small list of the whole day. Esc or a click outside closes it. */
function MoreItems({
  day,
  items,
  today,
  hidden,
}: {
  day: Date
  items: CalendarEntry[]
  today: string
  hidden: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="cal-more" ref={ref}>
      <button className="btn btn-ghost cal-more-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        +{hidden} more
      </button>
      {open && (
        <div className="cal-pop" role="dialog" aria-label={longDay.format(day)}>
          <h6 className="cal-pop-title">{longDay.format(day)}</h6>
          {items.map((e) => (
            <Item key={e.id} entry={e} today={today} />
          ))}
        </div>
      )}
    </div>
  )
}

function Agenda({ first, today, byDay }: DayProps) {
  const days = [...byDay.keys()].sort()
  return (
    <ol className="cal-agenda">
      {days.map((key) => {
        const [yy, mm, dd] = key.split('-').map(Number)
        const d = new Date(yy, mm - 1, dd)
        if (d.getMonth() !== first.getMonth()) return null
        const items = byDay.get(key) ?? []
        const isToday = key === today
        return (
          <li
            key={key}
            className={`cal-day${isToday ? ' today' : ''}`}
            aria-label={`${longDay.format(d)}, ${plural(items.length, 'item', 'items')}`}
          >
            <div className="cal-day-date" aria-hidden>
              <span className="cal-day-dow">{WEEKDAYS[d.getDay()]}</span>
              <span className="cal-day-num">{dd}</span>
            </div>
            <div className="cal-day-items">
              {items.map((e) => (
                <Item key={e.id} entry={e} today={today} large />
              ))}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** One to-do: opens the To-dos page scrolled to it. */
function Item({ entry, today, large }: { entry: CalendarEntry; today: string; large?: boolean }) {
  const overdue = entry.date < today
  return (
    <Link
      to="/todos"
      state={{ focusTodo: entry.id }}
      className={`cal-item${large ? ' large' : ''}${overdue ? ' overdue' : ''}`}
      title={entry.title}
    >
      <CheckSquareIcon className="cal-item-icon" aria-hidden />
      <span className="cal-item-title">
        {entry.title}
        {overdue && <span className="sr-only"> (overdue)</span>}
      </span>
    </Link>
  )
}
