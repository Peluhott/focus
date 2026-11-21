# Handoff: Focus App (v1 web UI)

## Overview
Focus is a single-user planning app that caps how many goals can be active at once (3, 5 or 7), ties projects and to-dos back to those goals, and flags in red any to-do that doesn't serve an active goal or project. This handoff covers the v1 web UI: Login, To-dos, Goals, Projects (list + detail) and Settings (AI toggle, API keys, export, account).

The product and technical spec is included as `Focus App - Product & Technical Spec.md`. Where this README and the spec disagree on behavior, **the spec wins**; this README is the authority on look and layout.

## About the Design Files
The files in this bundle are **design references created in HTML**: a clickable prototype showing intended look and behavior, not production code to copy. The task is to **recreate these screens in the target stack named in the spec**: React + Vite, TanStack Query, dnd-kit, Tailwind, talking to the AdonisJS `/api/v1` endpoints.

The prototype keeps all data in memory, fakes the AI alignment check with keyword matching, and does not persist anything. Replace all of that with real API calls (optimistic updates via TanStack Query, polling pending to-dos every 2 s per the spec).

To open the prototype: open `Focus App.dc.html` in a browser from this folder (it loads `support.js` and the design-system files under `_ds/`). Use the top nav to switch pages; "Sign out" goes to the Login screen.

## Fidelity
**Mid-to-high fidelity.** Colors, type, spacing and components are final and come from the Broadsheet design system (`_ds/.../styles.css`). Layouts and copy are intended as shipped. Some details are deliberately simplified (see "Not covered in the prototype"); build those from the spec using the same visual vocabulary.

## Visual system (read first)
Broadsheet is "newsprint for the web":
- Everything is set in **Source Serif 4**, including UI chrome. Do not introduce a sans-serif.
- Page structure uses **no boxes and no dividers** between sections; hierarchy comes from the type scale and whitespace. The one exception is the masthead's thick-thin rule pair around the dateline rail.
- Left-aligned, asymmetric layout: content hugs the left edge with whitespace on the right.
- Cyan (`--color-accent`) for interactive elements. Magenta (`--color-accent-2`) is reserved for the **unaligned** to-do flag. Never use both accents in one small component.
- Icons: **Phosphor, duotone weight** throughout (`@phosphor-icons/web@2.1.1` in the prototype; use `@phosphor-icons/react` with `weight="duotone"` in React).
- Map the tokens below into `tailwind.config` (theme.extend.colors / spacing / borderRadius / boxShadow / fontFamily) instead of hard-coding values.

## Global shell (all signed-in pages)
- **Page gutter:** `clamp(20px, 5vw, 64px)` left/right.
- **Nav bar** (`.nav`): flex, `align-items: baseline`, wraps, gap `10px 30px`, padding `20px 0 15px`.
  - Brand "Focus": 30px / 600 / letter-spacing -0.02em / line-height 1, `margin-right: auto`.
  - Links: To-dos · Goals · Projects · Settings, 14px, color inherits text; hover and current page (`aria-current="page"`) = `--color-accent`. The project detail page marks "Projects" as current.
- **Masthead rules + dateline rail**, directly under the nav:
  1. 3px solid `--color-text`
  2. 2px gap, then 1px solid `--color-text`
  3. Rail: flex-wrap, gap `4px 30px`, padding `7px 0 6px`, 11px, letter-spacing 0.1em, UPPERCASE. Items: today's date ("Friday, November 20, 2026"), "{n} of {limit} active goals", "{n} open to-dos", and (only when AI is on and n > 0) a warning icon + "{n} flagged" in `--color-accent-2-700`.
  4. 1px solid `--color-text`
- **Main content:** padding `40px <gutter> 140px`, `max-width: 900px`, not centered.
- **Page title:** `h1` 42px / 600 / line-height 1.12 / letter-spacing -0.015em. Subtitle line 17px in `--color-neutral-800`, 30px below before content.

## Screens

### 1. Login
- **Purpose:** single-account sign-in. Sign-up is closed.
- **Layout:** column, gap 40px, `max-width: 560px`, padding `clamp(48px, 14vh, 160px) <gutter> 64px`, min-height 100vh.
- **Wordmark:** "Focus" at `clamp(72px, 12vw, 120px)`, line-height 1, letter-spacing -0.03em, rendered with the design system's **`.cmyk-head` plate treatment** (a `.paper` span carrying the text, plus `.plate-c` / `.plate-m` / `.plate-y` aria-hidden repeats; `text-box: trim-both cap alphabetic`). See `styles.css` for the construction; copy it verbatim.
- **Tagline:** "A few goals at a time. Every project and to-do traces back to one." 19px / 1.45, max 30ch, 30px below the wordmark.
- **Form** (max-width 360px, gap 15px): Email field, Password field (`.field` + `.input`), primary button "Sign in" (`.btn .btn-primary .btn-block`, min-height 40px), then 12px muted note "Single account. Sign-up is closed."
- **Behavior:** submit → POST login → To-dos. Login is rate-limited (5/min) per spec; show errors in a 13px line under the form (not built in the prototype).

### 2. To-dos
- **Purpose:** one manually ordered list. No date views, no auto-sorting.
- **Header:** h1 "To-dos", subtitle "One list, in the order you set."
- **Quick add:** `.input`, 16px text, min-height 44px, max-width 720px, placeholder "Add a to-do and press Enter". Enter → insert at **top** of list, clear input, keep focus.
- **List:** column, gap 2px, margin-top 20px, max-width 720px. Each row:
  - Container padding `6px 8px 6px 4px`, radius 2px, `border-left: 3px solid transparent`.
  - Main line (flex, align center, gap 10px):
    1. **Drag handle**: `dots-six-vertical` 18px, `--color-neutral-500`, cursor grab, focusable (`tabIndex=0`, role button, label "Reorder (drag, or use arrow keys)"). ArrowUp/ArrowDown move the item one place (keyboard alternative). Use dnd-kit with its keyboard sensor.
    2. **Checkbox** 18×18, `accent-color: --color-accent`.
    3. **Title**: borderless inline input, 16px, flex 1, padding `5px 2px`. Click to edit in place.
    4. **Aligned chip** (if aligned): `.tag .tag-accent` with `target` icon (goal) or `folder-simple` icon (project) + matched name, max-width 220px, text ellipsis.
    5. **Date chip** (if dated): `.tag`, nowrap. Normal: bg `--color-neutral-200`, text `--color-neutral-800`, label "Nov 21". Overdue (date < today): label "Overdue · Nov 19", bg `color-mix(in srgb, var(--color-process-yellow) 30%, var(--color-bg))`, text `oklch(0.42 0.1 70)`. Amber is used only for overdue; red is reserved for the AI flag.
    6. **Calendar button**: `.btn .btn-ghost .btn-icon` 32×32, `calendar-blank` 18px, `--color-neutral-700`. Toggles the expanded panel.
  - **Unaligned state** (AI on, `aligned: false`, confidence ≥ 0.6): row bg `--color-accent-2-100`, left border `--color-accent-2`. A second line, indented 60px (aligned with the title), 13px, gap `2px 12px`: `warning` icon + reason text in `--color-accent-2-800`, then ghost buttons "This is fine" and "Link to…" (13px, padding `2px 6px`, color `--color-accent-700`). Red is never the only signal: icon + reason text always appear.
  - **Link picker** (after "Link to…"): line indented 60px, gap 6px: "Link to" label 12px neutral-700, then one `.btn .btn-secondary` per active goal (`target` icon) and planning/active project (`folder-simple` icon), 12px, padding `4px 10px`; then "Cancel" ghost. Picking sets a manual link (`alignment_source: manual`).
  - **Expanded panel** (indented 60px, max-width 600px, gap 10px): Notes `textarea.input` (min-height 64px, bg `--color-bg`, placeholder "Notes"); a row with a date input (`.input`, width auto), "Clear date" ghost (only when dated), "Link to…" ghost with `link` icon, and "Delete" ghost with `trash` icon pushed right (`margin-left: auto`, `--color-neutral-700`).
- **Complete:** checking removes the row immediately and shows the Undo toast (5 s). Undo restores it at its original index.
- **Empty state:** "Nothing on the list." in neutral-700.
- **Drag feedback:** dragged item at 40% opacity; drop target shows a 2px cyan line on its top edge (`box-shadow: inset 0 2px 0 var(--color-accent)`). One `PATCH { before_id | after_id }` per move.

### 3. Goals
- **Header:** h1 "Goals", subtitle "{n} of {limit} active goals".
- **Controls row** (flex, wrap, align end, gap 15px):
  - `.field` labelled "Active goals" with a `select.input` (width auto, min-width 96px) of 3 / 5 / 7. Options below the current active count are `disabled`.
  - `.btn .btn-primary` "New goal" with `plus` icon, min-height 36px. Disabled at the limit.
- **Messages** (13px): at the limit, "You're at your limit. Complete or archive a goal, or raise your limit." (neutral-800). When lower options are disabled, a hint for the nearest one: "Archive 2 goals to drop to 3." (neutral-700).
- **New goal input** (after clicking New goal): `.input` 16px, min-height 44px, autofocus, placeholder "Goal title, then Enter", plus "Cancel" ghost. Enter creates (API returns `409 goal_limit_reached` at the limit); Esc cancels.
- **Goal cards:** grid, gap 20px, margin-top 30px, max-width 760px. Each is a `.card` (bg `--color-surface`, radius 2px), padding `20px 20px 15px 10px`, inner gap 15px:
  - Header: drag handle (same as to-dos) + editable title (borderless input, 25px / 600 / line-height 1.25 / letter-spacing -0.015em).
  - Meta row under the title (13px, neutral-700, gap `6px 20px`): **progress bar** (flex `0 1 180px`, min-width 100px, height 6px, track `--color-neutral-300`, fill `--color-accent`, radius 1px) + "{done} of {total} sub-goals" (or "No sub-goals yet") + `folder-simple` icon "{n} linked projects".
  - Everything below is indented 30px.
  - "Details" ghost toggle (13px, caret-right / caret-down icon) revealing a markdown `textarea.input` (bg `--color-bg`, min-height 80px, placeholder "Why this goal matters, what done looks like. Markdown works."). Collapsed by default.
  - Sub-goal checklist: rows with 16×16 checkbox, borderless title input (15px; done = line-through + `--color-neutral-600`), and an `x` icon button 28×28 to remove. Below: `.input` (bg `--color-bg`) "Add a sub-goal and press Enter".
  - Actions (gap 10px): `.btn-secondary` "Complete" (`check-circle`), ghost "Archive" (`archive`), ghost "Delete" (`trash`, neutral-700).
- **Complete / Archive:** goal leaves the list with the 5 s Undo toast ("Goal completed" / "Goal archived"), freeing a slot. If undoing would exceed the limit, show "Can't undo: you're at your limit." instead.
- **Delete:** confirmation dialog (below). Deleting unlinks its projects.
- **Archived section** (margin-top 40px): ghost toggle "Archived · {n}" (17px, text color, caret icon), collapsed by default. Rows: title (16px, neutral-800), ghost "Restore" (`arrow-counter-clockwise`, disabled at the limit with tooltip "You're at your limit"), ghost "Delete".
- **Empty state:** "No active goals yet."

### 4. Projects (list)
- **Header:** h1 "Projects".
- **Filters row** (gap 15px, align end, 30px below): Status `select` (All but archived · Planning · Active · On hold · Done · Archived; default "All but archived"), Goal `select` (All goals · No goal · each active goal; max-width 260px), `.btn-primary` "New project" (`plus`).
- **List** (grid, gap 2px, max-width 760px). Each row is clickable (opens detail), padding `12px 10px 12px 2px`, radius 2px, hover bg `color-mix(in srgb, var(--color-text) 5%, transparent)`:
  - Drag handle (click does not open the row).
  - Title 20px / 600 / line-height 1.25 ("Untitled project" if empty).
  - Meta line (13px, neutral-700, gap `4px 14px`, 6px below): status `.tag` (Active = `.tag-accent`, all others `.tag-neutral`), `target` icon + goal name (if linked), "{n} open tasks", "Next due {date}" (earliest of project due date and pending task due dates; omitted if none).
  - `caret-right` icon at the far right, neutral-500.
- **Empty state:** "No projects match these filters."
- **New project:** creates a project with an empty title and opens its detail view with the title focused.

### 5. Project detail
- max-width 760px.
- Back link: `arrow-left` + "Projects", 14px, no underline.
- **Title:** borderless input at h1 size (42px / 600 / 1.12 / -0.015em), placeholder "Untitled project", 15px below the back link.
- **Fields row** (gap 15px, margins `20px 0 30px`): Status select (Planning, Active, On hold, Done, Archived), Goal select ("None" + active goals; if the linked goal is no longer active, show it with " (not active)"), Due date input.
- **Details:** `.field` "Details" with `textarea.input`, min-height 140px, placeholder "Overview, links, decisions and notes. Markdown works."
- **Tasks** (`h3` 25px, 40px above): add input "Add a task and press Enter" (15px, min-height 40px). Enter appends to Pending.
  - `h6` section labels (13px, uppercase, letter-spacing 0.08em, neutral-700): "Pending · {n}" and "Complete · {n}".
  - Pending rows: drag handle, 17×17 checkbox, borderless title input 15px, optional due `.tag .tag-neutral`. Empty: "Nothing pending."
  - Complete rows (indented 26px to align with pending checkboxes): checked checkbox, title 15px, line-through, neutral-600. Most recently completed first. Unchecking moves a task to the end of Pending. Completed tasks never disappear.
- Footer: ghost "Delete project" (`trash`, neutral-700) → confirmation dialog → back to list.

### 6. Settings
Sections in a grid, gap 40px, max-width 720px. Section heads are `h3` (25px); body copy is 15px in neutral-800, max 58ch.
- **AI alignment check:** copy: "Compares each open to-do with your active goals and projects, and flags the ones that don't serve any of them. When it's off, nothing is checked and no chips or highlights show." Control: `.seg` with two `.seg-opt` radios, "On" / "Off".
- **API keys:** head row with `h3` and `.btn-secondary` "New key" (`key` icon; disabled while the form is open). Copy: "Keys call the same /api/v1 endpoints as the web app, limited by scopes. They can't manage keys, the password or the focus limit."
  - **New key form** (max-width 520px, gap 15px): Name input (placeholder "Laptop scripts"), Scopes checkboxes in an auto-fill grid (min 150px) showing `goals:read`, `goals:write`, `projects:read`, `projects:write`, `todos:read`, `todos:write` in monospace 12px; "Expires (optional)" date input; `.btn-primary` "Create key" (disabled until name + at least one scope) and ghost "Cancel".
  - **Key created dialog:** title "Copy your new key", body "This is the only time the full key is shown. Only its hash is stored.", key in a monospace 13px block (bg `--color-bg`, padding `10px 12px`, radius 2px, `word-break: break-all`), actions `.btn-secondary` "Copy" (→ "Copied") and `.btn-primary` "Done". Key format `fk_` + random secret.
  - **Key rows** (gap 20px): name 17px / 600; meta line 13px neutral-700: prefix in monospace ("fk_7Qm2…"), scopes comma-joined, "Last used Nov 19" or "Never used", "Expires Dec 31" or "No expiry". Right side: ghost "Revoke" or, once revoked, `.tag-neutral` "Revoked" with the row at 60% opacity.
  - Empty: "No keys yet."
- **Data:** "Download all goals, projects, tasks and to-dos as JSON." + `.btn-secondary` "Export all" (`download-simple`). Shows toast "Export downloaded".
- **Account:** email shown as text + `.btn-secondary` "Sign out" (`sign-out`).

## Shared components
- **Undo toast:** fixed, bottom 24px, left = page gutter, z-index 40. Flex, gap 20px, padding `8px 8px 8px 16px`, bg `--color-surface`, `--shadow-lg`, radius 2px, 14px. Message + ghost "Undo". Auto-dismisses after 5 s. `role="status"`.
- **Confirmation dialog:** `.dialog-backdrop` (z-index 50) + `.dialog` with `.dialog-title`, `.dialog-body`, `.dialog-actions` (ghost "Cancel", primary action). Copy: "Delete this goal?" / "“{title}” and its sub-goals will be deleted. Linked projects stay, without a goal." / "Delete goal"; for archived goals, "“{title}” will be deleted permanently."; for projects "Delete this project?" / "“{title}” and its tasks will be deleted." / "Delete project".
- **Drag handle + drop line:** identical on to-dos, goals, projects and pending tasks (see To-dos).
- **Inline-editable text:** borderless, transparent inputs that inherit the font; focus shows the system's `:focus-visible` ring (2px cyan, 2px offset).

## Interactions & Behavior
- **Optimistic UI everywhere:** add, edit, check, reorder and delete update instantly; the server confirms in the background.
- **AI alignment display** (spec section "How it's shown"):
  - `pending` → show nothing (no spinner). `error` → neutral, with a small "retry" link (not built in the prototype; style as 13px ghost link in `--color-accent-700`).
  - `aligned` → chip with matched goal/project name.
  - `unaligned` with confidence ≥ 0.6 → red row treatment described above. Below 0.6 → treat as aligned without a chip.
  - `dismissed` → neutral; re-flag only if title/notes change.
  - Manual links are never overwritten by the AI.
  - AI off → no chips, no red, no "flagged" count in the rail.
- **Re-checks:** to-do title/notes edits trigger a re-check 1.5 s after typing stops; goal, sub-goal, project and task changes re-check open to-dos in one debounced batch (server-side per spec).
- **Goal limit:** enforced in the UI (disabled button, disabled lower options, disabled Restore) and by the API (`409 goal_limit_reached`).
- **Responsive:** all rows wrap; nothing uses fixed widths beyond max-widths. Must work on a phone (spec). Chips shrink with ellipsis before the title input does.
- **Transitions:** none are specified; keep state changes instant. Optional: 150 ms ease-out fade for the toast.

## State (client)
Server state lives in TanStack Query (`goals`, `subgoals`, `projects`, `tasks`, `todos`, `settings`, `keys`). Local UI state used by the prototype:
- `expanded[todoId]`, `linkingTodoId`: to-do row panels
- `detailsOpen[goalId]`, `subInput[goalId]`, `addingGoal`, `newGoalTitle`, `archivedOpen`
- `filters.status` (`open` = all but archived), `filters.goal` (`all` | `none` | goalId)
- `keyForm { name, scopes, expires }`, `newKey` (plain key, held only until the dialog closes)
- `toast { message, undo }` with a 5 s timer; `confirm { title, body, action, run }`
- Poll `GET /todos?alignment_status=pending` every 2 s while any are pending.

## Design Tokens (from `styles.css`)
**Color**
- `--color-bg` #f3f2f2 · `--color-surface` #eae9e9 · `--color-text` #201e1d
- `--color-accent` #0088b0 · `--color-accent-2` #d6006c · `--color-process-yellow` #edbb00 (overdue chip tint only)
- `--color-divider`: `color-mix(in srgb, #201e1d 16%, transparent)`
- Neutral 100–900: #f8f4f4, #eae7e7, #d7d3d3, #bab6b6, #9b9797, #7d7979, #605d5d, #444141, #2d2b2b
- Accent 100–900: #e9f8ff, #cbeeff, #99e0ff, #62c5ee, #38a6cf, #1186ac, #006786, #004961, #0a303e
- Accent-2 100–900: #fff1f4, #ffdee6, #ffc0d0, #ff90b1, #ff458e, #d82071, #aa0b56, #790e3d, #4b1528
- Links: `--color-accent-700`, hover `--color-accent-800`. Body-size text in an accent always uses the 700 step or darker.

**Type:** Source Serif 4 (400, 600, italic 400) from Google Fonts. Body 15px / 1.55. h1 42, h2 32, h3 25, h4 20, h5 16, h6 13 (uppercase, 0.08em); headings 600, line-height 1.12, letter-spacing -0.015em.

**Spacing:** `--space-1` 5px, `-2` 10px, `-3` 15px, `-4` 20px, `-6` 30px, `-8` 40px.

**Radius:** sm 1px, md 2px, lg 4px.

**Shadows:** sm `0 1px 2px` / md `0 3px 10px` / lg `0 12px 32px`, all in `#2d2b2b` at 14% / 16% / 22%.

**Component classes to port** (all in `styles.css`): `.btn` (+ `-primary`, `-secondary`, `-ghost`, `-icon`, `-block`), `.tag` (+ `-accent`, `-neutral`), `.field`, `.input`, `.seg` / `.seg-opt`, `.card`, `.nav` / `.nav-brand`, `.dialog-backdrop` / `.dialog*`, `.cmyk-head`. Hover, pressed, focus and disabled states are defined there; reuse them as is.

## Assets
- No images.
- Icons (Phosphor duotone): dots-six-vertical, calendar-blank, warning, target, folder-simple, link, trash, plus, check-circle, archive, x, caret-right, caret-down, arrow-counter-clockwise, arrow-left, key, copy, download-simple, sign-out.
- Font: Source Serif 4 via Google Fonts (imported at the top of `styles.css`).

## Not covered in the prototype
Build these from the spec in the same visual language: markdown rendering/preview, sub-goal details and sub-goal drag, task due-date editing and task details, the AI "retry" link for `error`, login errors and rate-limit messages, API error surfaces (`422`, `429`), and the eval-set tooling.

## Files
- `Focus App.dc.html`: the full prototype (all six screens, one file). Template markup plus a `Component` logic class containing sample data, state handling and the fake alignment classifier.
- `support.js`: runtime needed to open the prototype in a browser. Not part of the design.
- `_ds/broadsheet-…/styles.css`: Broadsheet tokens and component classes. **This is the source of truth for every visual value.**
- `_ds/broadsheet-…/_ds_bundle.js`: design-system bundle (print-plate filter defs used by `.cmyk-head`).
- `Focus App - Product & Technical Spec.md`: product and technical spec (data model, API, AI check, build phases).
