# Handoff: Focus landing page

## Overview
The public homepage for Focus, a goal-first to-do app. The existing login/signup splash screen is kept as the hero. Below it, the page explains why Focus exists, shows three core features with small product previews, lists secondary features and says what makes the app different, then closes with a sign-up call to action. Scroll-driven motion is part of the design.

## About the design files
`Landing Page 1a.dc.html` is a **design reference built in HTML**, a prototype of the intended look and motion. It is not production code. Recreate it in the target codebase's environment (React, Vue, Next, etc.) using its existing patterns. If no environment exists yet, pick the most suitable framework. Open the file in a browser to see it running (it needs `support.js` and the `_ds/` folder beside it).

## Fidelity
**High fidelity.** Final colors, type, spacing, copy and motion. Recreate it pixel-for-pixel, using the Broadsheet tokens and classes in `_ds/.../styles.css`.

## Global rules (Broadsheet system)
- One typeface everywhere: **Source Serif 4** (400, 600, italic 400) from Google Fonts. No sans-serif, not even for UI chrome.
- Page ground `#f3f2f2`, ink `#201e1d`. Cyan `#0088b0` is the interactive accent. Magenta `#d6006c` is a rare second spot color.
- No section dividers or layout boxes. Sections are separated by whitespace only. `.card` is used only for the product-preview mockups.
- Layout is flush left and asymmetric (the hero is the only centered block).
- Icons: Phosphor, **duotone** weight (`@phosphor-icons/web@2.1.1`).
- Page side padding: `clamp(20px, 6vw, 112px)`.

## Sections (top to bottom)

### 0. Sticky nav (appears after the hero)
- `position: fixed; top: 0`, full width, `z-index: 10`, padding `12px <side>`, background `#f3f2f2`, `--shadow-sm`.
- Left: wordmark "Focus", 600 weight, 26px, line-height 1, letter-spacing -0.03em.
- Right: `.btn-ghost` "Log in" + `.btn-primary` "Sign up", 40px min-height, padding 0 18px, gap 10px.
- Hidden at `translateY(-110%)`. Slides to `none` once `scrollY > 0.8 × viewport height`, and back up when scrolling above that. Transition: `transform 420ms cubic-bezier(.2,.7,.2,1)`.

### 1. Hero (existing login splash, unchanged)
- `min-height: 100vh`, flex centered, padding `64px clamp(20px,5vw,64px)`, `overflow: hidden`.
- **Background distraction words** (absolutely positioned, `aria-hidden`, non-selectable, nowrap). Position / size / color / blur:
  | Text | Position | Font-size | Color | Blur | Drift |
  |---|---|---|---|---|---|
  | *Reorganize bookmarks* (italic) | left 5.6%, top 10.5% | max(20px, 2.65vw) | neutral-600 `#7d7979` | 5px | 0.5 |
  | Reply to Sam about dinner | left 36%, top 6% | max(15px, 1.72vw) | neutral-600 | 0 | 0.25 |
  | Browse flights | right 7.5%, top 13.75% | max(24px, 3.1vw) | neutral-500 `#9b9797` | 7px | 0.7 |
  | Clean out the inbox | left 11.7%, top 31% | max(16px, 1.88vw) | neutral-600 | 0 | 0.35 |
  | *New video game?* (italic) | right 9.4%, top 36% | max(17px, 2.03vw) | neutral-600 | 3.5px | 0.45 |
  | Rearrange the desk | left 3.75%, top 59% | max(26px, 3.44vw) | neutral-500 | 8px | 0.8 |
  | Watch that documentary | right 5%, top 62.5% | max(15px, 1.72vw) | neutral-600 | 0 | 0.3 |
  | *Sort old photos* (italic) | left 11%, bottom 10% | max(17px, 2.03vw) | neutral-600 | 1px | 0.4 |
  | Price new headphones | right 14%, bottom 7.5% | max(20px, 2.5vw) | neutral-500 | 6px | 0.65 |
- **Center column** (max-width 760px, gap 20px, text centered):
  - H1 "Focus": 600, `clamp(96px, 13vw, 168px)`, line-height 0.85, letter-spacing -0.05em.
  - Goal row (16px, gap 10px 28px, wraps): three items, each a `ph-target` icon in accent-700 `#006786` + text: "Ship Focus v1", "Run a half marathon", "Build an emergency fund".
  - Tagline, italic 19px, neutral-800 `#444141`, balanced: "A few goals at a time. Every project and to-do traces back to one."
  - Buttons (margin-top 20px, gap 10px): `.btn-primary` "Log in", `.btn-secondary` "Sign up"; min-height 44px, padding 0 28px. Both open the existing auth panel (login and signup modes respectively).

### 2. Why Focus
- Padding-top `clamp(96px, 14vw, 180px)`, grid gap 20px.
- H6 kicker "Why Focus": 13px uppercase, letter-spacing 0.08em, accent-700.
- H2: italic 400, `clamp(40px, 5vw, 64px)`, line-height 1.05, letter-spacing -0.02em, max-width 17ch, balanced: "Most to-do lists grow faster than the goals behind them."
- Body: `clamp(18px,1.6vw,21px)`, line-height 1.55, neutral-800, max-width 52ch: "Focus starts from the other end. You name the few things you're working toward. Projects, to-dos and notes each point back to one of them, and anything that doesn't gets flagged."

### 3. What's inside
- Padding-top `clamp(120px, 16vw, 200px)`. Gap between blocks `clamp(80px, 10vw, 120px)`.
- Kicker "What's inside" + H2 "Three habits, built in." (600, `clamp(32px,3.6vw,44px)`, -0.015em).
- **Three feature rows.** Each is a grid `repeat(auto-fit, minmax(min(100%, 380px), 1fr))`, column gap `clamp(40px,7vw,96px)`, items vertically centered. Text on the left, preview card on the right (they stack on narrow screens).
  - Text column: 32px duotone icon in accent-700, H3 30px/600, paragraph 18px/1.55 neutral-800.
  - Card: `.card` + `--shadow-sm`, background `#eae9e9`, radius 2px, padding 30px, `aria-hidden`, not interactive.

  **3a. A cap on active goals** (icon `ph-target`)
  - Copy: "Choose how many goals can be active at once. Three is the default. A new goal waits until there's room."
  - Card: header row with "GOALS" (11px uppercase, 0.1em, neutral-700) and "3 of 3 active" (14px, accent-700). Then three goal rows, each with the title (600, 21px) and a percentage (14px neutral-700) above a 4px bar (track neutral-200 `#eae7e7`, fill accent `#0088b0`): Ship Focus v1 62%, Run a half marathon 40%, Build an emergency fund 25%. Last row: `.btn-secondary` "+ Add goal" at 45% opacity (disabled look), then "Finish or pause one to make room." (15px neutral-700).

  **3b. Every to-do checked** (icon `ph-link-simple`)
  - Copy: "Each new to-do is matched to the goal or project it serves. Anything that doesn’t fit gets flagged, so you can relink it or let it go."
  - Card: "TO-DOS" label; rows with a `ph-circle` (20px neutral-600) + title + `.tag-accent` with a `ph-target` icon: "Easy 5 km run" → "Run a half marathon"; "Transfer $20 to savings" → "Build an emergency fund". Third row "Research a new video game to play" is shown blurred (`filter: blur(1.5px); opacity: .7`), with a warning below it (13px, accent-2-800 `#790e3d`, `ph-warning` icon, 32px left inset): "Doesn't relate to any active goal."

  **3c. Help me start** (icon `ph-footprints`)
  - Copy: "Stuck on a to-do? Get a small first step you can add to the list."
  - Card: row "Plan the Japan trip" with a 32×32 icon button on the right (accent-100 `#e9f8ff` fill, accent-700 footprints icon). Below it, a suggestion panel (margin-left 32px, padding 12px 14px, neutral-100 `#f8f4f4`, radius 2px): footprints icon, "START HERE" (12px uppercase 0.1em accent-800), "Open a note and list three cities you want to see." (16px/1.45), then buttons `.btn-secondary` "+ Add as to-do" and `.btn-ghost` "↻ Another idea" (14px, padding 6px 12px / 6px 10px).

- **Also in Focus.** H4 in neutral-800, then a grid `repeat(auto-fit, minmax(min(100%,260px),1fr))` with gap 30px 40px. Each item has a title row (600, 17px, 22px accent-700 icon, gap 8px) and a 15px neutral-800 line:
  - `ph-timer` Focus timer: "Sits in the nav bar. 25 minutes unless you change it."
  - `ph-briefcase` Personal and Work: "Separate goals, lists and settings for each workspace."
  - `ph-folder-simple` Projects and files: "Tasks and attachments, grouped under a goal."
  - `ph-note` Notes: "Plain writing space, searchable with everything else."
  - `ph-calendar-blank` Calendar: "Dated to-dos and deadlines by month."
  - `ph-magnifying-glass` Search with ⌘K: "Find any goal, to-do, note or file, or add a new to-do."

### 4. What makes it different
- Padding-top `clamp(120px,16vw,200px)`. Kicker "What makes it different". H2 (44px max, max-width 20ch): "Most apps help you add more. Focus helps you choose."
- Three columns (`minmax(min(100%,260px),1fr)`, gap 40px). Each column: italic numeral 56px accent-700, H4 22px, body 16px/1.55 neutral-800.
  1. Goals come first: "You set what you're working toward before you write a single task. Lists stay in service of it."
  2. It says no for you: "A limit on active goals and a flag on to-dos that don't serve one. Taking on everything stops being the default."
  3. It helps you begin: "When a to-do feels too big, Focus offers one small first step instead of another reminder."

### 5. Close
- Padding `clamp(140px,18vw,220px) <side> clamp(100px,12vw,160px)`, left aligned.
- H2 "Pick your three.": 600, `clamp(56px,7vw,88px)`, line-height 0.95, -0.04em.
- Italic 21px neutral-800: "Start with one goal. Add the rest when you need them."
- `.btn-primary` "Sign up" + `.btn-secondary` "Log in" (44px, padding 0 28px).

### 6. Footer
- Padding `0 <side> 48px`, space-between, 14px neutral-700. Left: wordmark "Focus" 600 20px ink. Right: "© 2026".

## Motion

Easing for everything: `cubic-bezier(.2,.7,.2,1)`. Durations: opacity and transform 800ms, filter 1000ms, width (bars) 1300ms. Each element has its own delay (listed below). **Reveals run once**, when an element first enters the viewport (IntersectionObserver, threshold 0.2, rootMargin `0px 0px -10% 0px`). When a preview card enters, all of its animated children are triggered at the same moment and play out on their own delays, so each card's sequence plays in full.

**Reveal types (from state → to state)**
| Type | From | To |
|---|---|---|
| up | opacity 0, translateY(28px) | opacity 1, none |
| card | opacity 0, translateY(56px) scale(.98) | opacity 1, none |
| focus | opacity .2, blur(10px) | opacity 1, blur(0) |
| fade | opacity 0 | opacity 1 |
| pop | opacity 0, scale(.8) | opacity 1, none |
| slide | opacity 0, translateY(-12px) | opacity 1, none |
| blur | blur(0), opacity 1 | blur(1.5px), opacity .7 |
| bar | width 0% | target width |

**Per-section choreography (delays in ms)**
- Hero, scroll-linked (updated every frame while scrolling), with `y = scrollY` and `h = viewport height`:
  - Each distraction word: `translateY(-y × drift)`, `blur(baseBlur + y/45 px)`, `opacity = max(0, 1 − y/(0.7h))`. Drift values are in the hero table.
  - Center column: `translateY(y × 0.2)`, `opacity = max(0, 1 − y/(0.85h))`.
- Why Focus: kicker up 0, headline **focus** 100, paragraph up 350.
- What's inside heading: kicker up 0, H2 up 100.
- Each feature row: icon up 0, H3 up 80, paragraph up 160, card **card** 150.
  - 3a card: bars fill at 500 / 750 / 1000, "3 of 3 active" fades at 1500, the Add goal row goes up at 1700.
  - 3b card: tags pop at 650 / 950, the video-game row blurs at 1450, the warning goes up at 1800.
  - 3c card: footprints button pops at 600, suggestion panel slides at 950.
- Also in Focus: H4 up 0, then items go up at 0, 60, 120, 180, 240, 300.
- Different: kicker 0, H2 100, columns 0 / 180 / 360.
- Close: headline **focus** 0, line up 300, buttons up 450.

**Reduced motion.** If `prefers-reduced-motion: reduce` is set, skip all reveals and the hero parallax: render the end states, with the hero words at their base blur. The sticky nav still appears, but you can make it instant.

**No-JS / SSR.** The markup's default styles are the end states. JS sets the "from" states on mount, so content is never hidden if scripts fail.

## Interactions
- Hero "Log in" opens the existing auth panel in login mode. "Sign up" opens it in signup mode. The sticky nav and close buttons do the same. (The prototype links every button to the app file; wire them to the real auth routes.)
- Buttons use the system states: primary hover accent-600 `#1186ac`, active accent-700. Secondary hover is a 7% ink tint, active 14%. Ghost hover is a 10% accent tint. Focus ring on every button: `:focus-visible { outline: 2px solid #0088b0; outline-offset: 2px }`.
- Preview cards are decorative (`aria-hidden`, `pointer-events: none`).

## State
- `navVisible` (boolean): derived from `scrollY > 0.8 × innerHeight`.
- Per-element `revealed` flag, set once by the observer.
- Scroll handler throttled with `requestAnimationFrame`.
- No data fetching.

## Design tokens
- Colors: bg `#f3f2f2`, surface `#eae9e9`, text `#201e1d`, accent `#0088b0`, accent-2 `#d6006c`, divider = text at 16%.
- Neutral ramp 100→900: `#f8f4f4 #eae7e7 #d7d3d3 #bab6b6 #9b9797 #7d7979 #605d5d #444141 #2d2b2b`
- Accent ramp: `#e9f8ff #cbeeff #99e0ff #62c5ee #38a6cf #1186ac #006786 #004961 #0a303e`
- Accent-2 ramp: `#fff1f4 #ffdee6 #ffc0d0 #ff90b1 #ff458e #d82071 #aa0b56 #790e3d #4b1528`
- Spacing: 1=5px, 2=10px, 3=15px, 4=20px, 6=30px, 8=40px
- Radius: sm 1px, md 2px, lg 4px
- Shadows: sm `0 1px 2px rgb(45 43 43 / .14)`, md `0 3px 10px rgb(45 43 43 / .16)`, lg `0 12px 32px rgb(45 43 43 / .22)`
- Type: body 15px/1.55. Base headings (600, line-height 1.12, -0.015em): h1 42, h2 32, h3 25, h4 20, h5 16, h6 13 (uppercase, 0.08em). The landing page overrides sizes as listed above.

## Assets
- Font: Source Serif 4 (Google Fonts).
- Icons: Phosphor duotone. `target`, `link-simple`, `footprints`, `circle`, `warning`, `plus`, `arrows-clockwise`, `timer`, `briefcase`, `folder-simple`, `note`, `calendar-blank`, `magnifying-glass`.
- No images.

## Files
- `Landing Page 1a.dc.html`: the prototype. The markup has inline styles. The motion logic is in the `<script data-dc-script>` block at the bottom: the `FROM`/`TO` maps, `setup()` (observer) and `tick()` (hero parallax and sticky nav). Elements are tagged `data-rv` (reveal type), `data-d` (delay), `data-w` (bar width) and `data-drift`/`data-blur` (hero words).
- `_ds/broadsheet-…/styles.css`: Broadsheet tokens and component classes (`.btn*`, `.tag*`, `.card`, `.elev-*`).
- `support.js`, `_ds_bundle.js`: runtime needed to open the prototype locally. Not needed for implementation.
- The magenta italic notes under each section (film-strip icon) describe the motion for review. **Don't ship them.**
