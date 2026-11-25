# Handoff: Notes page (Focus App)

New page. Route `/notes`; nav item "Notes" between Projects and Calendar, count = number of notes. Prototype: click Notes in the nav.

## Data / hooks — `web/src/lib/notes.ts`
Follow the existing query-hook pattern (TanStack Query):
- `useNotes()` → `GET /notes` (ordered by `position`).
- `useCreateNote()` → `POST /notes { title: '', body: '' }`; insert at the top, select it, focus the title.
- `useUpdateNote()` → `PATCH /notes/:id { title?, body? }`, debounced autosave (see Editor).
- `useDeleteNote()` → `DELETE /notes/:id`, optimistic, with Undo.
- `useReorderNotes()` → reorder endpoint used by the other lists. **Use the shared per-list scope in `optimistic.ts`** (one scope for the notes list) so overlapping drags don't clobber each other.

## Layout
Section max-width 1120px, centered.
- **Header** (flex-wrap, space-between, align end, gap 15px, margin-bottom 30px): h1 "Notes"; `.btn-primary` `plus` "New note" (min-height 36px).
- **Body** (flex-wrap, align start, gap `30px 40px`):
  - **List column**: `flex: 1 1 260px`, max-width 360px, min-width 0.
  - **Editor column**: `flex: 3 1 420px`, min-width 0. Wraps under the list on narrow screens.

### List column
- Search: `.input type="search"`, min-height 40px, padding-left 36px, placeholder "Search notes", `aria-label="Search notes"`, with a `magnifying-glass` 17px icon (neutral-600) absolutely placed at left 12px.
- While searching: 12px neutral-700 line "{n} match(es). Clear the search to reorder." (margin-top 8px). Filtering is case-insensitive over title + body.
- Rows: grid `minmax(0, 1fr)`, gap 2px, margin-top 15px. Each row is clickable (selects the note), flex, align start, gap 6px, padding `10px 10px 10px 2px`, radius 2px. Selected bg `--color-accent-100`; hover bg `color-mix(in srgb, var(--color-text) 5%, transparent)`.
  - Drag handle (`dots-six-vertical` 18px, neutral-500, focusable, arrow keys reorder). **Hidden while searching** (a 22px spacer keeps alignment).
  - Title: heading font 17px / 600 / 1.3, one line, ellipsis. Empty title shows "Untitled note" in neutral-700.
  - Snippet: first non-empty line of the body, 13px neutral-700, one line, ellipsis; "No text" if empty.
  - Date (right, 12px neutral-700): "Today" or "Nov 18".
  - Drag feedback same as other lists: dragged row 40% opacity, drop target `box-shadow: inset 0 2px 0 var(--color-accent)`.
- Empty: "No notes yet." No matches: "No notes match "{query}"." (neutral-700).

### Editor column
- Title: borderless input, heading font 34px / 600 / 1.15, letter-spacing -0.015em, placeholder "Untitled note", autofocus for a new note.
- Save status (`role="status"`, 12px neutral-700, gap 6px, margin `8px 0 20px`): `cloud-arrow-up` "Saving…" → `check` "Saved" → otherwise `clock` "Edited today" / "Edited Nov 18".
- Body: borderless textarea, 17px / 1.65, max-width 68ch, min-height 360px, `field-sizing: content`, no resize, placeholder "Write something. Markdown works.".
- Ghost `trash` "Delete note" (neutral-700), 30px below.
- Nothing selected: "Select a note, or start a new one." With notes present, the first visible note is selected by default.

## Behavior
- **Autosave like `NotesField`:** update local cache on every keystroke, show "Saving…", PATCH 700 ms after typing stops, then "Saved". Bump `updated_at`.
- **Delete:** removes immediately, clears the selection, Undo toast "Note deleted" (5 s) restores it at its index and reselects it.
- **New note** clears the search.

## Icons
`plus`, `magnifying-glass`, `dots-six-vertical`, `cloud-arrow-up`, `check`, `clock`, `trash`, `note` (duotone).
