# Handoff: Recurring to-dos (Focus App)

Addendum to `README.md` (To-dos, §3). Behavior and data come from `Focus - Project Files, Recurring To-dos & Multi-goal Matching.md` (the feature spec); this file covers the UI. Where they disagree on visuals, this file wins; on data and API, the spec wins.

In the prototype: To-dos page, rows "Transfer $20 to savings" and "Stretch after the run".

## Summary
A recurring to-do is one row that never leaves the list. Checking it logs a completion, then the checkbox clears itself. It has no date.

## Recurring band (page layout)
The To-dos page is now, top to bottom:
1. Quick-add input (unchanged; max-width 720px, margin-bottom 20px). New to-dos are one-time.
2. **Recurring band**, only when at least one recurring to-do exists: bg `--color-accent-100`, radius 2px, padding `15px 15px 10px 20px`, max-width 720px. Inside (grid, gap 10px):
   - Label (grid, gap 4px): `repeat` icon + "RECURRING" (heading font 12px / 600, letter-spacing 0.1em, uppercase, `--color-accent-800`, gap 6px), then "Always on your list. Check off each time." (13px / 1.35, neutral-700).
   - The recurring rows (same row component, column, gap 2px).
3. **One-time list**: 20px below the band, no label.

Order within each group follows the user's manual order; drag and keyboard reorder work within a group. Turning Repeat on or off moves the to-do into or out of the band. An item from "Help me start" added above a recurring to-do lands in the one-time list.

## Row (main line)
Same row as a normal to-do (README §3), with these changes:

- **Repeat icon** right after the checkbox: `repeat` (duotone) 16px, `--color-accent-700`, `margin-left: -4px` (sits 6px from the checkbox), `title="Repeats"`, `aria-label="Repeats"`.
- **Tally**, after the title and before the goal chip: inline-flex, gap 10px, 12px, `--color-neutral-700`, no wrap.
  - "Done {count}×" (multiplication sign U+00D7).
  - If checked today: `check` icon + "today" in `--color-accent-700`, gap 3px.
- **No date chip.** Recurring to-dos have no date.
- **Help me start** button before the panel button (see `START-SMALL.md`).
- **Panel button:** the calendar icon becomes `dots-three`, labelled "Notes and repeat" (`aria-label` and `title`). Normal rows keep `calendar-blank` "Date and notes".
- Goal chip, red tint, blur and reason line behave as for any to-do.

## Expanded panel
Order: Notes textarea, then one row (flex-wrap, gap `--space-2`):

1. **Repeat toggle**: a label wrapping a native checkbox with `role="switch"` (16×16, `accent-color: --color-accent`), `repeat` icon 16px, and "Repeat". 14px, gap 8px, padding `6px 10px 6px 2px`. Shown on **every** to-do's panel.
2. Date input + "Clear date": **hidden while Repeat is on**.
3. "Link to…", "Delete" (right-aligned), unchanged.

When Repeat is on, add a note under the row: "Stays on the list. Each check-off logs one completion. Repeating to-dos have no date, so they don't appear on the calendar." 13px, `--color-neutral-700`.

Toggling:
- **On:** `PATCH { recurring: true }`. If the to-do had a date, clear it and toast "Repeat is on. The date was removed." (no Undo).
- **Off:** `PATCH { recurring: false }`. The tally is hidden; past completions stay counted. The date input reappears empty.

## Checking off
1. Click the checkbox → it shows **checked for 1000 ms**, then unchecks itself. The row doesn't move.
2. The completion is logged **immediately** (optimistic): `count + 1`, "✓ today" appears, and the climb/goal tracker on Goals counts it.
3. Toast (5 s): "Completion logged · Done {count}×." with **Undo**. If it crosses a camp or peak, add the milestone sentence used for normal completions ("You reached the ridge at 600." / "You topped level 2 at 500.").
4. **Undo** → `DELETE /completions/:id`; restore the previous count and today state.
5. Ignore clicks while the 1 s check is showing (prevents accidental double logs). After it clears, the user can check again; there's no daily limit.

**Red (unaligned) recurring to-do:** checking it does **not** log a completion. It leaves the list for the off-track backlog and stops repeating. Toast: "Moved to the off-track backlog. It no longer repeats." with Undo (puts it back as a recurring to-do at its index).

## Elsewhere
- **Calendar:** recurring to-dos never appear (no date).
- **Nav count / dateline "open to-dos":** a recurring to-do counts as one open to-do.
- **Focus tracker:** each check-off is one completion in `total` and in `byGoal`, exactly like a normal completion.

## Data (client view)
```
todo.recurring: boolean
todo.completion_count: number     // "Done N×"
todo.last_completed_at: timestamp // derive "✓ today" by comparing to the local date
```
`last_completed_at` isn't in the spec's Todo fields. Return it, or derive "today" from `GET /completions?from=<today>&to=<today>`.

`PATCH /todos/:id { done: true }` on a recurring to-do returns `done: false`, the new `completion_count` and the completion id (needed for Undo).

## Accessibility
- The checkbox's accessible name stays "Complete". After a check-off, announce the toast (`role="status"`).
- The tally is plain text, so screen readers read "Done 14 times"; add `aria-label="Done 14 times"` on the tally span.

## Icons
`repeat`, `check`, `dots-three` (duotone).
