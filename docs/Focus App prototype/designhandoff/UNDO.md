# Handoff: Undo for deletes (Focus App)

Addendum to `README.md`. Explored in `Undo Ideas.dc.html`. The chosen design is option **1b**, a stacking toast.

## Rules
- **No confirm dialogs for deletes.** Goals, sub-goals, to-dos, projects, files and notes delete immediately and show the undo toast.
  - This replaces the old "Delete this goal / project / file?" dialogs.
  - Other confirms (e.g. revoking an API key) are unchanged.
- **Deletes stack.** If a delete toast is already showing, the next delete joins it and the timer restarts.
- Non-delete toasts replace whatever toast is showing and don't stack. Examples: "To-do completed", "Goal archived", "Completion logged".

## Toast
- **Position:** fixed, bottom-left (`left: clamp(20px, 5vw, 64px); bottom: 24px`), z-index 40, max-width `min(520px, 100vw - 40px)`.
- **Container:** `--color-surface`, `--shadow-lg`, `--radius-md`, 14px.
- **Row:** padding 8px 8px 8px 16px, gap `--space-3`.
- **Message:**
  - 1 delete: "Title" deleted (curly quotes).
  - 2 or more: "N items deleted". Under it, an italic 13px neutral-700 line lists the titles, comma-separated, on one line with ellipsis.
- **Status:** "Paused" (12px, neutral-700) while hovered.
- **Undo button:** `.btn-ghost`, labeled "Undo", or "Undo all" when there are 2 or more. A "⌘Z" key hint sits inside it.
- **Progress bar:** 2px at the bottom. `--color-accent` drains 100% → 0 over the toast's duration (`fx-drain`, linear). It turns `--color-neutral-500` and pauses while hovered.

## Timing
- Toasts with Undo (deletes, completions, archive/complete goal) last **10 s**. Info-only toasts last 5 s.
- Hovering the toast pauses the timer. Leaving resumes it with the remaining time.

## Undo
- **Undo all** restores the batch in reverse order of deletion, so every item returns to its original position.
- **⌘Z / Ctrl+Z** does the same as the button while a toast offers undo, unless focus is in a text field.
- **What comes back:**
  - Goal: restored with its sub-goals, and the projects that were linked to it are relinked. If restoring an active goal would exceed the focus limit, show "Can't undo: you're at your limit." instead.
  - Project: restored with its tasks and files. Deleting one from its detail page returns you to Projects.
  - File: restored to the same index in its project.
  - To-do, sub-goal, note: restored to the same index. A note is reselected.

## Production notes
- Soft-delete on the server. Mark `deleted_at` immediately, and purge after the toast expires (or nightly for anything older than a minute). Undo clears `deleted_at`.
- For files, delay the storage delete until the purge.

## Files
`Focus App.dc.html`: `showToast(msg, undo, del)`, `delToast()`, `toastHover()`, `runUndo()`, `deleteGoal()`, and the `onDelete` handlers.
