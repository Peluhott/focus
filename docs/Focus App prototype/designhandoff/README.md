# Handoff: Focus App (v1 web UI)

## Overview
Focus is a single-user planning app that caps how many goals can be active at once (3, 5 or 7) and ties every to-do back to a goal. To-dos that don't serve any active goal are blurred. The Goals page doubles as the home page and carries an all-time "climb" tracker that turns completed to-dos into progress up a series of mountains.

Screens: Login, Goals (home, with the focus tracker), To-dos, Projects (list + detail), Calendar, Settings.

**Addenda** (each one overrides the matching section below):
- `LOGIN.md`: the new "Depth of field" login page. Replaces §1.
- `RECURRING-TODOS.md`: recurring to-dos on the To-dos page (§3).
- `PROJECT-FILES.md`: the Files section on Project detail (§5).
- `CALENDAR.md`: the Calendar page.
- Feature spec for recurring to-dos and project files: `Focus - Project Files, Recurring To-dos & Multi-goal Matching.md`. Multi-goal matching from that spec is **not designed yet**.

The product and technical spec is included as `Focus App - Product & Technical Spec.md`. **Where the spec and this README disagree, this README wins for the items listed under "Changes from the spec"; for everything else (data model, API, AI pipeline) the spec wins.**

## About the Design Files
The files in this bundle are **design references created in HTML**: a clickable prototype showing intended look and behavior, not production code to copy. Recreate these screens in the target stack named in the spec (React + Vite, TanStack Query, dnd-kit, Tailwind, AdonisJS `/api/v1`) using its established patterns.

The prototype keeps all data in memory, fakes the AI alignment check with keyword matching, and persists nothing. Replace all of that with real API calls (optimistic updates, polling pending to-dos every 2 s per the spec).

To open: open `Focus App.dc.html` in a browser from this folder (it loads `support.js` and `_ds/…`).

## Fidelity
**High fidelity.** Colors, type, spacing, components, layout and copy are final and come from the Broadsheet design system (`_ds/.../styles.css`). Recreate them exactly using the tokens below.

## Changes from the spec (design decisions made after the spec)
1. **Goals is the home page** and the first nav item. Sign-in lands on Goals.
2. **To-dos link to goals only**, never directly to projects. The alignment check compares a to-do with each active goal; a goal's vocabulary includes its title, details, sub-goals, and the titles/details/open tasks of non-archived projects linked to that goal. A match returns `{ status: 'aligned', type: 'goal', id }`.
3. **Unaligned to-dos are blurred** instead of shown in red as the main signal (see To-dos).
4. **Centered layout**: page headers and lists are centered on Goals, To-dos and Projects.
5. **Focus tracker** ("Focus so far") added to the bottom of Goals, with a leveled mountain climb.

## Visual system (read first)
Broadsheet is "newsprint for the web":
- Everything is set in **Source Serif 4**, including UI chrome. No sans-serif.
- No boxes or dividers between sections; hierarchy from type and whitespace. Exceptions: the nav's 1px baseline rule and `.card` for goal cards.
- Cyan (`--color-accent`) for interactive elements and progress. Magenta (`--color-accent-2`) only for the unaligned/off-goal signal. Never both accents in one small component.
- Icons: **Phosphor, duotone weight** (`@phosphor-icons/react` with `weight="duotone"`).
- Map the tokens into `tailwind.config` instead of hard-coding values.

## Global shell (signed-in pages)
- **Page gutter:** `clamp(20px, 5vw, 64px)` left/right.
- **Header** (padding `30px <gutter> 0`): one flex row, `flex-wrap: wrap`, `align-items: flex-end`, `justify-content: space-between`, gap `20px 40px`.
  - **Left block** (column, gap 10px, padding-bottom 10px):
    - Wordmark "Focus": heading font, 48px / 600 / line-height 1 / letter-spacing -0.03em, plain `--color-text` (no plate treatment).
    - Dateline: flex-wrap, gap `2px 14px`, 11px, letter-spacing 0.1em, UPPERCASE, `--color-neutral-800`. Items: today's date ("Friday, November 20, 2026"), "{n} open to-dos", and (AI on and n > 0) `warning` icon + "{n} flagged" in `--color-accent-2-700`.
  - **Nav (index tabs)** on the right: flex-wrap, `align-items: flex-end`, gap `10px 30px`. Order: **Goals, To-dos, Projects, Settings**. Each item is a link, column, gap 8px:
    - Label row (flex, `align-items: flex-start`, gap 3px, padding `0 2px`): name in heading font 26px / 600 / line-height 1 / letter-spacing -0.01em, followed by a superscript-style count 12px in `--color-accent-700` (Goals = active goals, To-dos = open to-dos, Projects = non-archived projects; Settings has no count).
    - Tab bar: 5px tall, `--color-accent` on the current page, transparent otherwise.
    - Color: current `--color-text`, others `--color-neutral-700`; hover `--color-accent-700`. Set `aria-current="page"` on the current item. Project detail marks Projects as current.
  - Under the whole row: 1px rule in `--color-text`. The current tab's 5px bar sits directly on this rule.
- **Main:** padding `40px <gutter> 140px`.

## Screens

### 1. Login
**Superseded by `LOGIN.md`.** The description below is the previous design, kept for reference only.
- Column, gap 40px, max-width 560px, padding `clamp(48px, 14vh, 160px) <gutter> 64px`, min-height 100vh.
- Wordmark "Focus" at `clamp(72px, 12vw, 120px)`, line-height 1, letter-spacing -0.03em, with the **`.cmyk-head` plate treatment** (`.paper` span + aria-hidden `.plate-c/-m/-y` repeats, `text-box: trim-both cap alphabetic`). This is the only place the plate treatment appears.
- Tagline: "A few goals at a time. Every project and to-do traces back to one." 19px / 1.45, max 30ch.
- Form (max-width 360px, gap 15px): Email, Password (`.field` + `.input`), `.btn-primary .btn-block` "Sign in" (min-height 40px), 12px muted "Single account. Sign-up is closed."
- Submit → Goals.

### 2. Goals (home)
**Header** (centered column, `text-align: center`, gap 15px, padding-top 20px):
- h1 "What you're climbing toward": `clamp(40px, 6vw, 64px)`, italic, weight 400, letter-spacing -0.02em, `text-wrap: balance`.
- "{n} of {limit} slots taken", `--color-neutral-800`.
- **Slots row** (margin-top 20px, flex-wrap, centered, gap `20px 40px`): one slot per limit (3/5/7). Each slot is a 160px-wide centered column, gap 8px:
  - Number "01", "02"… heading font 56px / 600 / line-height 1. Filled: `--color-text`; empty: `--color-neutral-500`.
  - Bar 40×3px: filled `--color-accent`, empty `--color-neutral-300`.
  - Filled: goal title 15px / 1.3, `text-wrap: balance`. Empty: ghost button "Open slot" with `plus` icon (14px, padding `2px 8px`) that opens the new-goal input.
- **Limit control** (margin-top 15px): "LIMIT" label (12px, 0.08em, uppercase, neutral-700) + `.seg` with radios 3 / 5 / 7. Options below the current active count are disabled.
- Messages (13px, centered): at the limit, "You're at your limit. Complete or archive a goal, or raise your limit." (neutral-800); when a lower option is disabled, "Archive {n} goals to drop to {x}." (neutral-700).
- New-goal input (centered, max-width 600px, margin-top 20px): `.input` 16px, min-height 44px, autofocus, placeholder "Goal title, then Enter", plus ghost "Cancel". Enter creates (API `409 goal_limit_reached` at the limit); Esc cancels.

**Goal cards:** CSS grid, `grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 420px))`, `justify-content: center`, gap 20px, margin `40px auto 0`, max-width 1400px. The cards are centered as a group. Each is a `.card` (bg `--color-surface`, radius 2px), padding `20px 20px 15px 10px`, gap 15px:
- Drag handle (`dots-six-vertical` 18px, neutral-500, focusable, arrow keys reorder) + auto-growing title textarea (25px / 600 / 1.25 / -0.015em, borderless). Enter blurs.
- Meta row (13px, neutral-700, gap `6px 20px`): progress bar (flex `0 1 180px`, min-width 100px, 6px, track neutral-300, fill accent), "{done} of {total} sub-goals" / "No sub-goals yet", `folder-simple` + "{n} linked projects".
- Indented 30px: ghost "Details" toggle (caret icon) → markdown textarea (bg `--color-bg`, min-height 80px, placeholder "Why this goal matters, what done looks like. Markdown works.").
- Sub-goal checklist: 16×16 checkbox, auto-growing title (15px; done = line-through + neutral-600), `x` button 28×28. Then `.input` "Add a sub-goal and press Enter".
- Actions (pinned to the card bottom, gap 10px): `.btn-secondary` "Complete" (`check-circle`), ghost "Archive" (`archive`), ghost "Delete" (`trash`, neutral-700).
- Complete/Archive → Undo toast ("Goal completed"/"Goal archived"); undo blocked at the limit with "Can't undo: you're at your limit." Delete → confirmation dialog.

**Archived** (margin `40px auto 0`, max-width 1400px): ghost toggle "Archived · {n}" (17px, caret), rows with title, ghost "Restore" (disabled at limit, tooltip "You're at your limit"), ghost "Delete".

**Focus tracker** (margin `60px auto 0`, max-width 1400px):
- Header: h2 "Focus so far", line "All time" (neutral-800). No date ranges anywhere.
- If AI is off: 13px note "The AI check is off, so new completions aren't being counted."
- Two columns: grid `repeat(auto-fit, minmax(min(100%, 340px), 1fr))`, gap 40px.
- **Left: Completed to-dos by goal.** h6 "Completed to-dos by goal · {total}". Rows (gap 14px): icon + label left, count right (14px), then a 6px bar (track neutral-200, radius 1px) with width = count / total. Rows: each active goal (`target` icon in accent-700, bar accent), then "Off-goal" (`warning` icon in accent-2-700, bar accent-2) = completions with no goal link.
- **Right: The climb.**
  - h6 "The climb · Level {n} · summit at {peak}".
  - Big count: heading font 42px / 600 / line-height 1 (all-time completed to-dos), followed by a sentence in neutral-800: "completed · {n} to the {camp} at {value}", or "completed · {n} to the summit" on the last leg, or "completed. You topped every level." at the end.
  - **Levels:** each level is one mountain with 5 equal steps; the step size is peak / 5. Peaks: **100, 500, 1,000, 5,000, 10,000, 50,000, 100,000** (steps 20, 100, 200, 1,000, 2,000, 10,000, 20,000). The count is cumulative: the current level is the first peak greater than the count. On reaching a peak the hiker starts the next mountain at the bottom, and the steps are measured from 0 (so at 1,000 the hiker is already at step 1 of the 5,000 mountain). Camp names for steps 1–5: Meadow, Tree line, Ridge, False summit, Summit.
  - **Mountain (switchbacks)** in a flex-wrap row with the level ladder (gap `30px 40px`, `align-items: flex-end`):
    - SVG `viewBox 0 0 400 240`, width 100%, height auto, `padding-top: 44px` above. Mountain polygon `10,232 104,124 122,116 200,16 262,92 276,98 390,232`, fill neutral-200, stroke `--color-text` 1.25px.
    - Trail: 5 legs zig-zagging up the face. Leg points i = 0…5: y = 222 − 40i; x = 200 for i = 5, otherwise 200 ± 0.72 × ((y − 16) / 216 × 190) (alternating sides, − for even i). The walked part is a 4px `--color-accent` polyline with round caps/joins; the rest is a 1.5px neutral-600 dashed line (4 4).
    - Step dots at points 1–4: 9px circles, stroke `--color-text` 1.25px; filled `--color-text` when reached, `--color-bg` otherwise. Labels (11px, 0.04em) beside each dot, outside the trail, showing the step value; reached in text color, ahead in neutral-700.
    - Summit: `flag-pennant` 24px at the peak, with "Summit · {peak}" 12px above it.
    - Hiker: `person-simple-hike` 28px positioned at the current point along the current leg (interpolated by count within the step).
  - **Level ladder** (flex `0 0 auto`, min-width 170px):
    - "{n}" (heading font 28px / 600) + "levels passed" / "level passed" (13px, neutral-800).
    - Rows listed **top = highest level, bottom = Level 1 (100)**, gap 2px. Each row: grid `22px auto 1fr`, height 32px, padding `0 8px`, radius 2px: icon (18px), "LEVEL {n}" (11px, 0.08em, uppercase), peak value right-aligned (15px).
    - Passed: `check-circle` in text color. Current: `person-simple-hike` in accent-700, row bg `--color-accent-100`, value weight 600. Ahead: `circle` in neutral-500, text neutral-700.
  - **Toasts on completion:** crossing a step: "To-do completed. You reached the {camp} at {value}." Crossing a peak: "To-do completed. You topped level {n} at {peak}." Otherwise "To-do completed".

### 3. To-dos
- Centered header: h1 "To-dos", subtitle "One list, in the order you set." (17px, neutral-800).
- Quick add: `.input` 16px, min-height 44px, max-width 720px, centered, placeholder "Add a to-do and press Enter". Enter inserts at the top.
- List: column, gap 2px, max-width 720px, centered (`margin: 20px auto 0`). Row text stays left-aligned. Each row (padding `6px 8px 6px 4px`, radius 2px, `border-left: 3px solid transparent`):
  - Main line (flex, center, gap 10px): drag handle, 18×18 checkbox, borderless title (16px), goal chip (`.tag .tag-accent`, `target` icon + goal name, max-width 220px, ellipsis), date chip, calendar icon button (32×32) that toggles the panel.
  - Date chip: normal bg neutral-200 / text neutral-800 ("Nov 21"); overdue "Overdue · Nov 19", bg `color-mix(in srgb, var(--color-process-yellow) 30%, var(--color-bg))`, text `oklch(0.42 0.1 70)`.
  - **Unaligned (AI on, no goal):**
    - Row bg `--color-accent-2-100`, left border `--color-accent-2`.
    - **The main line is blurred:** `filter: blur(2px)`, `opacity: 0.5`, `transition: filter 0.2s, opacity 0.2s`. Hovering the line sets `filter: none; opacity: 1`. The blur is also removed while the row's panel or link picker is open. Ensure keyboard focus inside the line also unblurs it (use `:focus-within`).
    - Second line (not blurred), indented 60px, 13px, gap `2px 12px`: `warning` icon + reason in accent-2-800 ("Doesn't relate to any active goal."), then ghost buttons (13px, padding `2px 6px`): "This is fine" and "Link to…" in accent-700, and **"Delete"** with `trash` icon in neutral-700 (deletes the to-do immediately).
    - "This is fine" → `dismissed`: no blur, no tint.
  - Link picker: "Link to" label + one `.btn-secondary` per **active goal** (`target` icon), then ghost "Cancel". Sets a manual link.
  - Expanded panel (indented 60px, max-width 600px): Notes textarea, date input, "Clear date", "Link to…", and "Delete" (`trash`, right-aligned).
- Complete: row leaves immediately, Undo toast (5 s) restores it at its index.
- Empty: "Nothing on the list." (centered).

### 4. Projects (list)
- Centered h1 "Projects". Filters row centered (`justify-content: center`): Status select (All but archived · Planning · Active · On hold · Done · Archived), Goal select (All goals · No goal · active goals), `.btn-primary` "New project".
- List: max-width 760px, centered. Rows (clickable, padding `12px 10px 12px 2px`, hover bg `color-mix(in srgb, var(--color-text) 5%, transparent)`): drag handle, title 20px / 600, meta line (status tag: Active = `.tag-accent`, others `.tag-neutral`; `target` + goal name; "{n} open tasks"; "Next due {date}"), `caret-right`.
- Projects can still belong to a goal; that link is what lets a project's words count toward the goal in the alignment check.

### 5. Project detail
- Column max-width 760px, centered on the page; content inside left-aligned.
- Back link (`arrow-left` "Projects"), title input at h1 size, fields row (Status, Goal, Due date), Details textarea, Tasks (add input, "Pending · n" / "Complete · n" lists, drag to reorder pending, completed most-recent-first), ghost "Delete project" → confirm.

### 6. Settings
Unchanged from the spec layout (left-aligned, max-width 720px, gap 40px). Updated AI copy: "Compares each open to-do with your active goals, and blurs the ones that don't serve any of them. When it's off, nothing is checked and no chips or highlights show." Sections: AI alignment check (`.seg` On/Off), API keys (new-key form, one-time key dialog, key rows with Revoke), Data ("Export all"), Account (email + "Sign out").

## Shared components
- **Undo toast:** fixed bottom 24px, left = gutter, z 40, bg surface, `--shadow-lg`, radius 2px, 14px, padding `8px 8px 8px 16px`, message + ghost "Undo". 5 s. `role="status"`.
- **Confirmation dialog:** `.dialog-backdrop` + `.dialog` (title / body / actions: ghost "Cancel", primary action).
- **Drag handle + drop line:** dragged item 40% opacity; drop target shows `inset 0 2px 0 var(--color-accent)` (goal cards: `inset 3px 0 0`). Arrow keys reorder.

## Prototype-only controls (do not build)
- **"Layout" switcher** (bottom-right on To-dos / Projects): a review toggle between Left and Centered. Ship **Centered**.
- **Tweaks:** `startPage`, `sampleData`, `climbPreview` (overrides the climb count for previewing levels), `fileStorage` (off shows the "File storage not set up" state).

## Interactions & Behavior
- Optimistic UI for add, edit, check, reorder, delete.
- AI display: `pending` → nothing; `aligned` → goal chip; `unaligned` (confidence ≥ 0.6) → tint + blur + reason line; below 0.6 → treat as aligned without a chip; `dismissed` → neutral until title/notes change; manual links never overwritten; AI off → no chips, no blur, no flagged count, completions not counted in the tracker.
- Re-checks: to-do edits 1.5 s after typing stops; goal, sub-goal and goal-linked project changes trigger a debounced batch re-check.
- Climb count = all-time completed to-dos (server should expose this total and the per-goal breakdown).
- Responsive: everything wraps; the mountain and ladder stack on narrow screens.

## State (client)
Server state in TanStack Query (`goals`, `subgoals`, `projects`, `tasks`, `todos`, `settings`, `keys`, plus completion stats `{ total, byGoal }`). Local UI state: `expanded[todoId]`, `linkingTodoId`, `detailsOpen[goalId]`, `subInput[goalId]`, `addingGoal`, `newGoalTitle`, `archivedOpen`, project filters, `keyForm`, `newKey`, `toast`, `confirm`.

Level math:
```
PEAKS = [100, 500, 1000, 5000, 10000, 50000, 100000]
level = index of first peak > count (else last)
peak  = PEAKS[level]; step = peak / 5
c     = min(count, peak)
leg   = min(4, floor(c / step)); t = (c % step) / step   // t = 1 at the final summit
levelsPassed = PEAKS.filter(p => count >= p).length
```

## Design Tokens (from `styles.css`)
**Color:** `--color-bg` #f3f2f2 · `--color-surface` #eae9e9 · `--color-text` #201e1d · `--color-accent` #0088b0 · `--color-accent-2` #d6006c · `--color-process-yellow` #edbb00
- Neutral 100–900: #f8f4f4, #eae7e7, #d7d3d3, #bab6b6, #9b9797, #7d7979, #605d5d, #444141, #2d2b2b
- Accent 100–900: #e9f8ff, #cbeeff, #99e0ff, #62c5ee, #38a6cf, #1186ac, #006786, #004961, #0a303e
- Accent-2 100–900: #fff1f4, #ffdee6, #ffc0d0, #ff90b1, #ff458e, #d82071, #aa0b56, #790e3d, #4b1528
- Links `--color-accent-700`, hover `--color-accent-800`.

**Type:** Source Serif 4 (400, 600, italic 400). Body 15px / 1.55. h1 42, h2 32, h3 25, h4 20, h5 16, h6 13 (uppercase, 0.08em). Headings 600, line-height 1.12, letter-spacing -0.015em.

**Spacing:** `--space-1` 5px, `-2` 10px, `-3` 15px, `-4` 20px, `-6` 30px, `-8` 40px.

**Radius:** sm 1px, md 2px, lg 4px. **Shadows:** sm `0 1px 2px`, md `0 3px 10px`, lg `0 12px 32px`, in #2d2b2b at 14% / 16% / 22%.

**Classes to port:** `.btn` (+ `-primary/-secondary/-ghost/-icon/-block`), `.tag` (+ `-accent/-neutral`), `.field`, `.input`, `.seg`/`.seg-opt`, `.card`, `.dialog*`, `.cmyk-head`. Hover, pressed, focus (2px cyan `:focus-visible`, 2px offset) and disabled states are defined there.

## Assets
- No images.
- Phosphor duotone icons: dots-six-vertical, calendar-blank, warning, target, folder-simple, link, trash, plus, check-circle, circle, archive, x, caret-right, caret-down, arrow-counter-clockwise, arrow-left, key, copy, download-simple, sign-out, flag-pennant, person-simple-hike.
- Font: Source Serif 4 (Google Fonts, imported in `styles.css`).

## Not covered in the prototype
Markdown rendering, sub-goal details/drag, task due-date editing, AI `error` retry link, login/rate-limit errors, API error surfaces (`422`, `429`), eval tooling.

## Files
- `Focus App.dc.html`: full prototype (all screens, one file): template markup plus a `Component` logic class with sample data, state, the fake classifier and the climb math.
- `support.js`: runtime to open the prototype. Not part of the design.
- `_ds/broadsheet-…/styles.css`: Broadsheet tokens and component classes, the source of truth for visual values.
- `_ds/broadsheet-…/_ds_bundle.js`: design-system bundle (plate filter defs).
- `Focus App - Product & Technical Spec.md`: product and technical spec.
- `Focus - Project Files, Recurring To-dos & Multi-goal Matching.md`: feature spec for project files, recurring to-dos and multi-goal matching.
- `LOGIN.md`, `RECURRING-TODOS.md`, `PROJECT-FILES.md`, `CALENDAR.md`: UI addenda.
