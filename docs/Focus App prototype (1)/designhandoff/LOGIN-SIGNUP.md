# Handoff: Login & Sign-up (Focus App)

Addendum to `README.md`. Overrides the Form section of `LOGIN.md` and supersedes "Single account. Sign-up is closed."

## Overview
The sign-in flow for Focus has two screens:

1. **Splash:** the existing "depth of field" login page. The inline email/password form is replaced with two buttons, **Log in** and **Sign up**.
2. **Auth panel:** a split screen opened by either button. The left side has the auth form (single sign-on buttons plus email). The right side shows an overview of the features that set Focus apart from other to-do apps, with live-looking previews.

This replaces the Form section (Center column, item 4) of `LOGIN.md` and adds a new screen. Everything else in `LOGIN.md` still applies (background words, wordmark, goals row, tagline).

## About the Design Files
The files in this bundle are **design references built in HTML**. They are prototypes that show the intended look and behavior, not production code to copy. Recreate them in the target codebase's existing environment (React, Vue, SwiftUI, etc.) using its established patterns and libraries. If there's no environment yet, pick the framework that suits the project best.

To view: open `Focus App.dc.html` in a browser. It opens on Goals. Go to Settings → Sign out to reach the splash, or set the `startPage` tweak to `login`.

## Fidelity
**High fidelity.** Final colors, type, spacing and copy. Recreate pixel-accurately using the Broadsheet design system tokens and classes listed below.

---

## Screen 1: Splash (changed)

Everything is unchanged from `LOGIN.md` except the form, which is **removed**. Put this button row in its place:

- Container: flex, `flex-wrap: wrap`, `justify-content: center`, gap `--space-2` (10px), `margin-top: 20px`.
- **Log in:** `.btn .btn-primary`, `type="button"`, min-height 44px, padding `0 28px`. Opens the auth panel in **login** mode.
- **Sign up:** `.btn .btn-secondary`, `type="button"`, min-height 44px, padding `0 28px`. Opens the auth panel in **signup** mode.

The splash no longer needs its solid-background form wrapper.

---

## Screen 2: Auth panel (new)

### Layout
- `main`: `min-height: 100vh`, `display: flex`, `flex-wrap: wrap`. Background `--color-bg`. No app nav.
- **Left column (auth):** `flex: 1 1 380px`, `min-width: 0`, `max-width: 600px`, padding `--space-6` (30px) top, `clamp(20px, 5vw, 64px)` sides, `--space-8` (40px) bottom. Flex column, gap `--space-8`.
- **Right column (features, `aside`):** `flex: 1.4 1 460px`, `min-width: 0`, background `--color-neutral-100` (#f8f4f4), padding `--space-6` top/bottom and `clamp(20px, 5vw, 72px)` sides. Flex column, `justify-content: center`, gap `--space-6`.
- Both columns need `min-width: 0` so they wrap based on flex-basis. They sit side by side down to about 840px viewport width, then the aside stacks below the form.

### Left column

**Header row:** flex, `space-between`, center-aligned, gap `--space-4`.
- Wordmark "Focus": heading font, weight 600, 40px, line-height 1, letter-spacing -0.03em.
- "Back" button: `.btn .btn-ghost`, `arrow-left` icon + "Back", color `--color-neutral-800`. Returns to the splash and clears the password.

**Form block:** `margin-top: --space-6`, display grid, gap `--space-6`, width 100%, max-width 380px. It sits directly under the header (not vertically centered) so the fields stay above the fold on short screens.

1. **Heading group** (grid, gap `--space-2`):
   - `h1`: `clamp(40px, 4vw, 56px)`, weight 600, line-height 1, letter-spacing -0.02em.
     - Login: "Welcome back"
     - Signup: "Make an account"
   - Subtitle `p`: 17px, italic, `--color-neutral-800`.
     - Login: "Pick up where you left off."
     - Signup: "Start with one goal. Add the rest when you need them."
2. **Mode switch:** Broadsheet `.seg` segmented control, `role="radiogroup"`, `aria-label="Log in or sign up"`, `justify-self: start`. Two `.seg-opt` labels wrapping radio inputs, "Log in" and "Sign up". Each option has padding `9px 18px`, font-size 14px. The checked option fills `--color-accent` with `--color-bg` text (DS default).
3. **Single sign-on group** (grid, gap `--space-3`):
   - Three `.btn .btn-secondary .btn-block` buttons, min-height 44px, gap 10px between icon and label, icon 20px:
     | Icon (Phosphor duotone) | Login label | Signup label |
     | --- | --- | --- |
     | `google-logo` | Continue with Google | Sign up with Google |
     | `windows-logo` | Continue with Microsoft | Sign up with Microsoft |
     | `apple-logo` | Continue with Apple | Sign up with Apple |
   - Note: `.btn-block` adds `margin-top: --space-2`, so the buttons sit about 25px apart.
   - Below them: "or with email", 13px, italic, `--color-neutral-700`.
   - In production, use each provider's brand-approved button guidelines if required (Apple and Google both have them). The prototype uses Phosphor duotone glyphs to stay in the system's style. Check with legal/brand before shipping.
4. **Email form** (grid, gap `--space-3`). Every field uses DS `.field` with the `<label>` as a **direct child**, so it gets the DS label style (12px, 70% ink, 5px bottom margin).
   - **Name** (signup only): `.input`, `autocomplete="name"`, placeholder "What should we call you?"
   - **Email:** `.input`, `type="email"`, `autocomplete="email"`.
   - **Password:** `.input`, `type="password"`, `autocomplete` = `current-password` (login) / `new-password` (signup).
   - **"Forgot it?"** (login only): link under the password input, 13px, `justify-self: start`, link color `--color-accent-700`, hover `--color-accent-800`.
   - **Submit:** `.btn .btn-primary .btn-block`, min-height 44px, `margin-top: --space-2`. Label "Log in" / "Create account".
5. **Switch line:** 14px, `--color-neutral-800`. Login: "New to Focus? **Sign up**". Signup: "Already have an account? **Log in**". The second part is a link that flips the mode.

### Right column: features overview

1. **Intro** (grid, gap `--space-3`, max-width 620px):
   - Kicker `h6` "What's inside": DS h6 (13px, uppercase, letter-spacing 0.08em), color `--color-accent-700`.
   - `h2` "A few goals at a time. Every project and to-do traces back to one.": `clamp(28px, 2.6vw, 38px)`, italic, weight 400, line-height 1.1, letter-spacing -0.015em, `text-wrap: balance`.
2. **Feature rows.** Two rows, each a grid: `grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr))`, gap `--space-4 --space-8`, `align-items: center`, max-width 900px. The text sits left and the preview right, and the preview drops below the text on narrow widths.
   - **Feature text** (grid, gap 6px): icon 28px `--color-accent-700`, `h4` (DS 20px, weight 600), `p` 15px `--color-neutral-800`.
   - **Preview:** `.card .elev-sm`, padding `--space-4 --space-6`, `min-width: 0`. Previews are **decorative**: `aria-hidden="true"`, `pointer-events: none`, static copy only. Never show real user data here.

#### Row A: Every to-do checked
- Icon `link-simple`. Title "Every to-do checked". Body: "Each new to-do is matched to the goal or project it serves. Anything that doesn't fit gets flagged, so you can relink it or let it go."
- Preview card (grid, gap 14px):
  - Label "TO-DOS": 11px, letter-spacing 0.1em, uppercase, `--color-neutral-700`.
  - Rows (flex-wrap, center, gap `6px 12px`). Each row is a `circle` icon (20px, `--color-neutral-600`), the title (`flex: 1 1 140px`), then a tag:
    - "Easy 5 km run" → `.tag .tag-accent` with `target` icon, "Run a half marathon"
    - "Transfer $20 to savings" → `.tag .tag-accent` with `target` icon, "Build an emergency fund"
    - "Research a new video game to play" → no tag. Under it (padding-left 32px, 13px, `--color-accent-2-800`): `warning` icon (16px) + "Doesn't relate to any active goal."

#### Row B: Help me start
- Icon `footprints`. Title "Help me start". Body: "Stuck on a to-do? Get a small first step you can add to the list."
- Preview card (grid, gap 12px):
  - To-do row: `circle` icon + "Plan the Japan trip" + an active "Help me start" icon button (32×32, `footprints` 18px, color `--color-accent-700`, background `--color-accent-100`).
  - Suggestion panel: `margin-left: 32px`, padding `12px 14px`, background `--color-neutral-100`, radius `--radius-md`. Flex with gap 12px:
    - `footprints` icon 20px `--color-accent-700`.
    - "START HERE": 12px, letter-spacing 0.1em, uppercase, `--color-accent-800`.
    - "Open a note and list three cities you want to see.": 16px, line-height 1.45.
    - Buttons (visual only): `.btn .btn-secondary` "Add as to-do" (`plus` icon, padding `6px 12px`, 14px) and `.btn .btn-ghost` "Another idea" (`arrows-clockwise` icon, padding `6px 10px`, 14px).
  - This copies the real in-app "Start small" panel. See `START-SMALL.md`.

---

## Interactions & Behavior
- Splash **Log in** → auth panel, login mode. Splash **Sign up** → auth panel, signup mode.
- The mode switch, the switch-line link and the buttons all change the mode in place. Heading, subtitle, SSO labels, submit label, password `autocomplete` and the Name field update to match. Keep typed email and password values when switching.
- **Back** → splash. Clears the password.
- **SSO buttons:** start the OAuth/OIDC redirect for that provider. On success go to Goals. In signup mode, a new account is created on first sign-in. In the prototype they log in immediately.
- **Email submit:**
  - Login → `POST /api/v1/auth/login` → Goals.
  - Signup → create account (new endpoint, e.g. `POST /api/v1/auth/signup` with name, email, password) → Goals. This supersedes the "Sign-up is closed" note in the original spec.
- After sign-in, scroll to top and reset to splash state on the next sign-out.
- No animations or transitions beyond DS defaults.

### Not in the prototype (build these)
- **Errors:** one line above the submit button, 14px, `--color-accent-2-800`, `warning-circle` icon.
  - Wrong credentials: "Email or password is incorrect." Keep email, clear password.
  - Email already in use (signup): "That email already has an account. Log in instead?" with "Log in" as a link that switches mode.
  - SSO cancelled or failed: "Couldn't sign in with {Provider}. Try again."
  - Rate limit (429): "Too many attempts. Try again in a minute."
- **Validation (signup):** name required; valid email; set a minimum password length to match the backend and show it as a hint under the field.
- **Loading:** disable all buttons while a request is in flight. Submit reads "Logging in…" / "Creating account…".
- **Forgot it?:** goes to a password reset flow (not designed).

## State Management
- `authMode`: `null` (splash) | `'login'` | `'signup'`.
- `name`, `email`, `password`: form fields.
- `status`: `idle` | `submitting` | `error`, plus `errorMessage`.
- Leaving the auth panel (Back or successful sign-in) sets `authMode` to `null` and clears `password`.

## Design Tokens (Broadsheet)
**Colors**
- `--color-bg` #f3f2f2 · `--color-surface` #eae9e9 (card fill) · `--color-text` #201e1d
- `--color-accent` #0088b0 · `-100` #e9f8ff · `-600` #1186ac · `-700` #006786 · `-800` #004961
- `--color-accent-2-800` #790e3d (warnings)
- `--color-neutral-100` #f8f4f4 (aside, suggestion panel) · `-600` #7d7979 · `-700` #605d5d · `-800` #444141
- `--color-divider`: `--color-text` at 16% (input and secondary-button borders)

**Spacing:** `--space-1` 5px · `-2` 10px · `-3` 15px · `-4` 20px · `-6` 30px · `-8` 40px. There is no `--space-5` or `--space-7`.

**Radius:** `--radius-sm` 1px · `--radius-md` 2px · `--radius-lg` 4px.

**Shadow:** `--shadow-sm` `0 1px 2px` #2d2b2b at 14% (`.elev-sm`).

**Type:** Source Serif 4 for everything (headings 600, body 400, true italic). Body 15px / 1.55. DS headings: h1 42, h2 32, h4 20, h6 13 uppercase. The sizes above override where stated.

**States:** use DS defaults. Primary hover `--accent-600`, pressed `--accent-700`. Secondary hover is ink at 7%. Focus is `:focus-visible` with a 2px `--color-accent` outline. Disabled is 45% opacity.

## Assets
- Icons: Phosphor Icons, **duotone** weight (`@phosphor-icons/web@2.1.1`): `arrow-left`, `google-logo`, `windows-logo`, `apple-logo`, `link-simple`, `footprints`, `circle`, `target`, `warning`, `plus`, `arrows-clockwise`.
- No images.

## Files
- `Focus App.dc.html`: login and auth panel markup is at the top of the template (`data-screen-label="Login"`, `"Login panel"`, `"Feature overview"`); logic in `renderVals()` (`authMode`, `au.*`, `openLogin`, `openSignup`, `closeAuth`, `onSignIn`).
