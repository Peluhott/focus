# Handoff: Calendar page (Focus App)

Addendum to `README.md`. Everything there still applies: the Broadsheet tokens, the Source Serif 4 type, Phosphor duotone icons and the global shell. `Focus App.dc.html` in this folder has been updated with the Calendar page. In the prototype, open it and click **Calendar** in the nav.

## Overview
A **read-only** month view of everything that has a due date. Nothing on this page can be edited, checked off or dragged.

What appears:
- **To-dos** that have a `date`.
- **Open project tasks** (`done = false`) that have a `due` date, from projects that are not archived.

What does not appear: project due dates, goals, sub-goals, completed tasks, and to-dos without a date.

## Fidelity
High fidelity. Use the values below exactly, taking colors and spacing from the Broadsheet tokens.

## Nav
- Add **Calendar** as the 4th item: Goals · To-dos · Projects · **Calendar** · Settings.
- Route: `/calendar`. Icon: `calendar-blank`. It has **no count** beside the label.
- The tab behavior (5px accent bar, `aria-current="page"`) is the same as the other nav items.

## Data
No new API is needed; the page is built from data the client already has.
```
items = [
  ...todos.filter(t => t.date)
     .map(t => ({ date: t.date, title: t.title, kind: 'todo' })),
  ...projects.filter(p => p.status !== 'archived')
     .flatMap(p => p.tasks.filter(k => !k.done && k.due)
       .map(k => ({ date: k.due, title: k.title, project: p.title, kind: 'task' })))
]
```
- Group the items by date.
- Within a day, to-dos come first, then project tasks, each in their existing list order.
- An item is **overdue** when `date < today` (dates are compared as local `YYYY-MM-DD` strings).

## State
- `month: { y, m }`: local UI state only, not saved. It defaults to today's month.
- The page always opens on the current month.

## Layout

### Section
- `max-width: 1240px`, centered (`margin: 0 auto`).
- Lives inside the standard `main` padding.

### Header
A centered column (`text-align: center`, gap `--space-2`).

**1. Month row** (flex, center, gap `--space-4`):
- **Previous month button:** `.btn .btn-ghost .btn-icon`, `caret-left` icon at 22px, `aria-label="Previous month"`.
- **h1:** the full month name, e.g. "November".
  - Size `clamp(40px, 6vw, 64px)`, italic, weight 400, letter-spacing -0.02em, `min-width: 7ch`.
  - Followed by the year ("2026") as a span: not italic, color `--color-neutral-600`.
- **Next month button:** `caret-right`, `aria-label="Next month"`.

**2. Summary line** (flex-wrap, centered, gap `4px --space-4`, 14px, `--color-neutral-800`):
- "{n} items due this month" ("1 item…"), or "Nothing due this month".
- If anything in the shown month is overdue: "{n} overdue", in `oklch(0.42 0.1 70)`. This is the same amber-brown as the To-dos overdue chip.
- When the shown month is not the current month: a **"Back to {current month}"** button.
  - `.btn-ghost`, 14px, padding `2px 8px`, `arrow-counter-clockwise` icon.
  - Clicking it resets `month` to today's month.

**3. Legend** (flex-wrap, centered, gap `4px --space-6`, 12px, letter-spacing 0.06em, uppercase, `--color-neutral-700`):
- `check-square` icon (15px, `--color-accent-700`) + "To-do"
- `folder-simple` icon (15px, `--color-neutral-700`) + "Project task"

### Month grid (viewport ≥ 1080px)
Grid: `grid-template-columns: repeat(7, minmax(0, 1fr))`, `column-gap: --space-2`, no row gap, `margin-top: --space-8`.

**Weekday header**
- Weeks start on **Sunday**: Sun Mon Tue Wed Thu Fri Sat.
- Each label is an `h6` (13px, uppercase, 0.08em) in `--color-neutral-700`, with padding `0 8px 8px`.

**Cells**
- Show whole weeks: the leading and trailing days from the neighboring months fill the first and last rows, giving 5 or 6 rows.
- Each cell is a flex column: gap 6px, `min-height: 128px`, padding `8px 8px 14px`.
- No borders or boxes. Each cell has only a **top rule** drawn as `box-shadow: inset 0 {w} 0 {color}`:

| Day | Rule | Background | Number |
| --- | --- | --- | --- |
| In month | 1px `--color-neutral-400` | none | `--color-text`, 400 |
| Today | **3px `--color-accent`** | `--color-accent-100` | `--color-accent-800`, **600** |
| Other month | 1px `--color-neutral-200` | none | `--color-neutral-500`, 400 |

- Day number: heading font 22px, line-height 1, padding-top 4px.
- Days from other months show their number only. Their items are not shown.

**Item (inside a cell)**
- Grid `15px minmax(0, 1fr)`, gap 5px, 13px, line-height 1.3.
- Icon (15px, margin-top 1px):
  - to-do: `check-square` in `--color-accent-700`
  - project task: `folder-simple` in `--color-neutral-700`
- Title: clamp to **3 lines** (`-webkit-line-clamp: 3`) with `overflow-wrap: anywhere`, so long single words like `goal_limit_reached` break instead of spilling into the next cell.
- Project tasks only: the project name on a second line, 11px, `--color-neutral-700`, single line with ellipsis.
- Native `title` attribute = "{title}" or "{title} · {project}", so cut-off text can be read on hover.
- Overdue: the title and icon both use `oklch(0.42 0.1 70)`. The project name stays neutral.

### Agenda list (viewport < 1080px)
- The grid is too cramped below 1080px, so the page shows a list instead.
- Column: gap `--space-6`, `max-width: 560px`, centered, `margin-top: --space-8`.
- **Only days in the month that have items** are listed.

**Each day**
- Grid `56px minmax(0, 1fr)`, gap `--space-3`.
- **Date column** (centered column, padding-top 2px):
  - weekday ("Tue"): 11px, uppercase, 0.08em
  - day number: heading font 600, 28px, line-height 1
  - Color: today in `--color-accent-800`, otherwise `--color-text`.
- **Items column:**
  - Column with gap 8px, padding `6px 0 0 --space-3`.
  - Left rule: `box-shadow: inset 2px 0 0` in `--color-accent` for today, `--color-neutral-300` otherwise.
  - Each item: grid `17px 1fr`, gap 6px, 15px, line-height 1.35. Same icons and overdue color as the grid.
  - Title: full, wraps with `overflow-wrap: anywhere`.
  - Project name below the title: 12px, neutral-700.

**Empty month:** "Nothing due this month." (centered, `--color-neutral-700`).

## Behavior
- Prev/next move one month at a time with no limit. The year rolls over (Dec → Jan).
- The page is read-only: items are not links and nothing can be dragged or checked off.
- Choose grid or list from the viewport width **on every render**, and listen for resize. In production, prefer measuring the section's own width with a `ResizeObserver` so it holds when the page sits beside other UI. Never decide once at mount.
- The calendar reflects edits made elsewhere as soon as the query cache updates. Examples: completing a to-do or task removes it; setting a date adds it.

## Accessibility
- Each cell should get an `aria-label` such as "Tuesday, November 24, 2 items". This is not in the prototype.
- Mark the grid as `role="grid"`, or make it a semantic `<table>`. Keyboard navigation between days is not needed because the cells have no actions.
- Overdue is shown by color only, so add visually hidden text "(overdue)" after overdue titles.

## Prototype-only
- The prototype fixes today at **2026-11-20**. Use the real local date.
- Extra sample due dates were added to project tasks k4, k8, k12, k13 and k14 to fill the month. They are not product data.
