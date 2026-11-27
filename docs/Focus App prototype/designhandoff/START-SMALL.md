# Handoff: "Help me start" on a to-do (Focus App)

Addendum to `README.md` §3 (To-dos). Prototype: To-dos page, footprints button on any row. Try "Save $5,000 for the Japan trip".

## What it is
A button on every to-do (one-time and recurring) that suggests **one small, concrete first step** for today. Example for "Save $5,000 for the Japan trip": "Cook dinner at home tonight instead of eating out, and move the $25 you would have spent into a savings account for the trip."

This replaces the earlier hint panel with an editable list of steps. There is no multi-step breakdown in the UI.

**Hidden entirely when the AI setting is off.**

## Row button
On the row's main line, just before the panel (calendar / dots) button:
- Ghost icon button 32×32, `footprints` 18px, color `--color-accent-700`.
- `aria-label` and `title`: "Help me start". `aria-expanded` reflects the card.
- While the card is open: bg `--color-accent-100`. Clicking again closes the card.

## Card
Under the row's main line (above the unaligned reason line, if any). Flex, align start, gap 12px, margin `4px 0 6px 56px`, padding `12px 8px 12px 14px`, max-width 600px, bg `--color-surface`, radius 2px.
- Left: `footprints` 20px, `--color-accent-700`, margin-top 2px.
- Middle (grid, gap 10px), by state:
  - **queued / running:** `role="status"` "Thinking of a first step…" (15px, neutral-700).
  - **ready:** "START HERE" (12px, 0.1em, uppercase, `--color-accent-800`), then the step (17px / 1.45, `text-wrap: pretty`). Actions (flex-wrap, gap 10px):
    - `.btn-secondary` `plus` **"Add as to-do"** (14px, padding `6px 12px`).
    - ghost `arrow-clockwise` **"Another idea"** (14px, padding `6px 10px`).
  - **added:** step text stays; `check` "Added above this to-do." (14px, accent-700) + "Another idea".
  - **error:** `role="alert"`, `warning-circle` 18px + the server's error text (14px, `--color-accent-2-800`), ghost "Try again" (accent-700). Prototype copy: "Couldn't think of a first step. The AI service didn't respond in time."
- Right: ghost icon button 28×28 `x`, "Close" (neutral-700).

## API
- **Open:** `POST /todos/:id/hint` (or whatever starts a run), then **poll `GET /todos/:id/hint` every 1 s while `status` is `queued` or `running`.** Stop on `ready` / `error`, on close, or on unmount.
- **Another idea:** same request with `{ force: true }`.
- **Try again:** repeats the last request (same `force`).
- **Step text:** use `text`. If the backend returns `steps[]` instead, show `steps[0]`. The prompt should ask for a single action small enough to do today, phrased as an instruction.
- **Add as to-do:** create one to-do with the step as its title, inserted **directly above** the source to-do. If the backend's breakdown endpoint is the only way, call it with one step; otherwise `POST /todos`. Link it to the same goal as the source to-do when that one is aligned; otherwise it goes through the normal alignment check. Then invalidate/refetch the to-do list. Toast "Added a to-do" with Undo (deletes it, card goes back to ready).
- **Close** discards the client state for that to-do. Reopening starts a new request.
