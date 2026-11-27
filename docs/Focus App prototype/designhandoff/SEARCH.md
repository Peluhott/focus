# Handoff: Search everything (Focus App)

Addendum to `README.md`. Explored in `Search Ideas.dc.html`. The chosen design is trigger **3c** (a field in the date line) opening the **2a** command palette.

## Trigger
- Lives at the end of the header's uppercase date rail, after the date, open-to-do count and flagged count.
- It looks like a field but is a `<button>`. Width 240px, `margin-left: 10px`, `padding-bottom: 3px`, bottom border 1px `--color-neutral-500`.
- Contents: `magnifying-glass` icon (15px), "Search everything", and a "⌘K" hint (letter-spacing 0.04em, not uppercased).
- Inherits the rail type: 11px, uppercase, letter-spacing 0.1em, `--color-neutral-700`.
- Hover: border `--color-accent`, text `--color-text`.
- Below 960px the rail moves under the brand row, and the trigger goes with it.

**Shortcuts** (not on the login screen):
- **⌘K / Ctrl+K** opens from anywhere.
- **/** opens when focus isn't in a text field.

## Palette
- **Backdrop:** fixed, z-index 50, `--color-text` at 28%. Clicking it closes the palette.
- **Dialog:**
  - Fixed, z-index 51, centered horizontally, `top: 12vh`, width `min(600px, 100vw - 32px)`.
  - `--color-bg`, `--shadow-lg`, `--radius-lg`.
- **Input row:**
  - Padding 14px 18px. `magnifying-glass` icon (22px, neutral-700).
  - Borderless input, 20px, autofocused, placeholder "Search goals, to-dos, projects, notes…". "esc" key hint.
- **Results:**
  - Max-height `min(400px, 60vh)`, scrolls. Top divider: inset shadow `0 1px 0 --color-divider`.
  - Group label: 11px uppercase, letter-spacing 0.1em, neutral-700.
  - Row: padding 8px 12px, radius-md, gap 12px. Type icon 18px in `--color-accent-700`. Title 16px with ellipsis, sub-line 13px neutral-700.
  - Selected row: `--color-neutral-200` fill and an "Open ↵" hint on the right.
- **Match highlight:** the matching part of the title is set 600 on `--color-accent-100`.
- **Footer:** "↑ ↓ to move", "↵ to open" and "esc to close" on the left, and "Searching Personal" or "Searching Work" on the right. 12px, neutral-700, inset top divider.

## What's searched (current workspace only)
| Group | Items | Matches on | Opens |
| --- | --- | --- | --- |
| To-dos | every to-do | title, notes | To-dos, with that to-do's details expanded |
| Goals | active + archived | title, details, sub-goal titles | Goals (archived section opened if needed) |
| Projects | projects and their tasks | title, details / task title | the project page |
| Files | project files | file name | the project page |
| Notes | notes | title, body | Notes, with that note selected |
| Calendar | dated to-dos, project due dates, open task due dates | "Nov 24 · Title" | Calendar at that month |

- Up to 4 results per group. Title matches rank above body or sub-line matches.
- The final group, **Add**, always offers: Add "query" as a to-do. It goes to the top of To-dos and runs the goal check.
- If no groups besides Add match, show: Nothing matches "query".

**Empty query:**
- **Jump to:** the first two to-dos.
- **Quick actions:** New to-do (opens To-dos and focuses the add field), Start the timer, New note, New project, Send feedback.

## Keyboard
- Arrow keys move the selection (hovering also selects).
- Enter opens the selected row.
- Esc closes.
- Opening search closes the feedback popup.

## Production notes
- Search on the server once data volume matters (e.g. `GET /api/v1/search?q=&workspace=`). Return the same group shape.
- Debounce input by ~120 ms.
- Use `role="combobox"` on the input with `aria-activedescendant` pointing at the selected option.

## Files
`Focus App.dc.html`: `searchIndex()`, `searchView()`, `openSearch()`, the `onSearchKey` listener, and the `search` state.
