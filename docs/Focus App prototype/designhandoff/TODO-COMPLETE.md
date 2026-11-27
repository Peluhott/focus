# Handoff: To-do completion animation (Focus App)

Addendum to `README.md`. Applies to the To-dos page. Explored in `To-do Complete Animation.dc.html` (option 1a, "Rise and clear").

## Behavior
When a one-off to-do's checkbox is ticked:
1. **+1 rises** from the checkbox (0 ms → 900 ms).
2. **Strike-through draws** across the title (0 → 380 ms). The title becomes read-only text in `--color-neutral-600`.
3. **Row folds away** at 1000 ms: max-height → 0, vertical padding → 0, opacity → 0 over 350 ms (`ease`).
4. **Item is removed** at 1350 ms. The "To-do completed" toast (with Undo) shows then, not on tick.
5. **"Done today" count** updates on tick.

Repeating to-dos get steps 1 and 5 only. They stay in the list (existing "Completion logged · Done N×" toast is unchanged).

Ticking an already-folding row does nothing. Undo puts the to-do back at its old index and lowers the count by one.

## Specs
**+1**
- Absolutely positioned above the checkbox: `left: 50%; bottom: 100%; margin-bottom: 2px`, `pointer-events: none`, `aria-hidden`.
- Heading font, 600, **italic**, 20px, line-height 1, `--color-accent-700`.
- Keyframes `fx-rise`, 900 ms `cubic-bezier(.2,.7,.3,1)` forwards:
  - 0%: opacity 0, `translate(-50%, 6px)`
  - 18%: opacity 1
  - 100%: opacity 0, `translate(-50%, -28px)`
- Unmount after ~950 ms so it never replays on re-render or page change.

**Strike-through**
- 1.5px line in `currentColor` at `top: 54%` of the title. Width animates 0 → 100% over 380 ms ease-out (`fx-strike`).

**"Done today"**
- Under the page subtitle, only once count > 0. Uses `role="status"`.
- Layout: `check-circle` icon (18px, `--color-accent-700`), the count (600, `--color-text`), then "done today". 15px, `--color-neutral-800`, gap 8px.
- On each change the count bumps (`fx-bump`, 500 ms ease-out). At 35% it reaches scale 1.14 and `--color-accent-700`, then returns. Clear the bump flag after ~550 ms.
- The count covers this session only (resets on reload). In production, compute it from today's completions.

## Reduced motion
Under `prefers-reduced-motion: reduce`, skip the rise, strike and bump animations. Show the struck state for ~600 ms, then remove the row without folding.

## Files
`Focus App.dc.html`: `markDone()`, `completeTodo()`, and the `fold` / `popKey` / `doneToday` state. Keyframes are in `<helmet>`.
