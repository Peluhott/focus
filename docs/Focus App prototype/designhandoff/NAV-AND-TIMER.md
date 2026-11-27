# Handoff: Two-row nav bar and timer (Focus App)

Replaces "Global shell → Header" in `README.md`. Prototype: any signed-in page, top of the screen.

## Layout (≥ 960px wide)
Header padding `30px <gutter> 0`. Inside, a CSS grid:
```
grid-template-columns: auto minmax(0, 1fr) auto;
grid-template-areas: "brand . rail"
                     "nav   . timer";
align-items: end;
gap: 30px 40px;   /* row gap var(--space-6), column gap var(--space-8) */
```
Then a 1px rule in `--color-text` under the whole grid. The current tab's 5px bar and the timer's progress bar both sit on that rule.

- **brand**: "Focus", heading font 48px / 600 / line-height 1 / letter-spacing -0.03em.
- **rail** (justify-self end, padding-bottom 6px): flex-wrap, gap `2px 14px`, 11px, letter-spacing 0.1em, uppercase, `--color-neutral-800`. Items: "Friday, November 20, 2026" (today), "{n} open to-dos", and when AI is on and n > 0: `warning` icon + "{n} flagged" in `--color-accent-2-700`.
- **nav**: flex-wrap, `align-items: flex-end`, gap `10px 30px`. Items in order **Goals, To-dos, Projects, Notes, Calendar, Settings**. Each item is unchanged from README (26px label, 12px accent-700 count, 5px bar). Counts: Goals = active goals, To-dos = open to-dos, Projects = non-archived, Notes = note count; Calendar and Settings have none.
- **timer**: justify-self end (see below).

## Layout (< 960px)
```
grid-template-columns: minmax(0, 1fr) auto;
grid-template-areas: "brand timer" "rail rail" "nav nav";
gap: 15px 40px;
```
Rail is left-aligned with no bottom padding.

## Timer
Column, gap 8px, `position: relative` (anchors the "New" popover).

**Top row** (flex, center, gap 2px, height 26px):
1. `timer` icon 20px, margin-right 4px. Color: running `--color-accent-700`; done `--color-accent-2-700`; otherwise `--color-neutral-700`.
2. **Time** — a button showing `m:ss` (or `h:mm:ss`), heading font 26px / 600 / line-height 1, `font-variant-numeric: tabular-nums`, min-width 2.7em, padding `0 3px`, radius 1px, transparent, `cursor: text`, hover bg `--color-accent-100`. Color: idle `--color-neutral-700`, running/paused `--color-text`, done `--color-accent-2-700`. `title="Change minutes"`, `aria-label="{m:ss} left. Change minutes"`. Wrapper has `role="timer"`.
3. Play/Pause icon button 32×32 (`play` / `pause`, 18px, text color). Labels: "Start timer", "Pause timer", "Resume timer".
4. Reset icon button 32×32 (`arrow-counter-clockwise`, neutral-700), label "Reset timer". Disabled when idle at full length.
5. When done, items 3–4 are replaced by ghost buttons (14px, padding `2px 8px`): `arrow-clockwise` **"Again"** and `plus` **"New"** (`aria-expanded`).

**Progress bar** under the row: 5px tall. Track neutral-300 (transparent when idle); fill `--color-text`, or `--color-accent-2` when done. Width = elapsed / length.

### Click-to-edit minutes
- Clicking the time swaps it for a text input (numeric only, max 3 digits, autofocus, selects its contents) prefilled with the current length, followed by "min" (13px, neutral-700). Input: width 2.2em, same type as the time, right-aligned, no border except a 2px `--color-accent` bottom border.
- **Enter** or **blur** commits: an integer 1–180 sets the timer to that length, **idle** (stopped, full). Invalid input reverts silently. **Esc** cancels.
- This changes the current timer only, not `settings.timer_minutes`.

### "New" popover
Absolute, right 0, `top: calc(100% + 10px)`, z 35, width 292px, padding 14px, gap 12px, bg surface, `--shadow-lg`, radius 2px, `role="dialog"` `aria-label="New timer"`.
- "NEW TIMER" (12px, 0.08em, uppercase, neutral-700).
- Presets 5, 10, 15, 25, 45, 60 min: buttons (14px, padding `4px 10px`); the current length is `.btn-secondary`, the rest `.btn-ghost`. Click starts immediately.
- Custom: number input (1–180, width 96px, bg `--color-bg`, placeholder "Minutes") + `.btn-primary` "Start" (disabled unless valid; Enter also starts) + ghost "Cancel".

### Behavior
- Initial length = `settings.timer_minutes`. Changing the setting while idle updates the timer; while running or paused it doesn't.
- **Reset** returns to the current length (including one typed via click-to-edit), idle.
- **At 0:** state → done, play a short chime (three 880 Hz sine beeps, 0.32 s apart, ~0.3 s each, gain 0.3; Web Audio, no asset). The prototype ticks every 250 ms and re-renders once per second.
- **Again** restarts with the same length. **New** toggles the popover.
- **Persistence:** store `{ status, lengthMin, endAt, remainingMs }` in `localStorage` under `focus.timer.v1` on every change. On load, if `status === 'running'` and `endAt` has passed, show it as done (no sound). Running timers keep counting from `endAt`, so a reload doesn't lose time.

## Icons
`timer`, `play`, `pause`, `arrow-counter-clockwise`, `arrow-clockwise`, `plus`, `warning` (duotone).
