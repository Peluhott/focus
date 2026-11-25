# Handoff: Login page, "Depth of field" (Focus App)

Addendum to `README.md`. This page **replaces** the Login section there (README §1). The tokens, type, icons and shell rules in the README still apply. In the prototype, set the `startPage` tweak to `login`, or click "Sign out" in Settings.

## Concept
The wordmark is the only sharp, large thing on the page. Distraction to-dos float around it at different blur levels, like a photo with a shallow depth of field. Three goals sit just under the wordmark in full focus. This shows what the app does before you sign in: things that serve a goal stay sharp, and the rest fade.

## Fidelity
High fidelity. Use these values exactly.

## Layout
- `main`: `position: relative`, `min-height: 100vh`, `overflow: hidden`, flex, centered both ways, padding `64px <gutter>` (gutter = `clamp(20px, 5vw, 64px)`). Background `--color-bg`. No nav or header.

### Background words (decorative)
- One absolutely positioned layer (`inset: 0`) with `aria-hidden="true"`, `pointer-events: none`, `user-select: none`, `white-space: nowrap`.
- Nine words. Positions are percentages of the viewport. Sizes scale with width (`max(min, vw)`) so they keep the 1280px composition at any width.

| Text | Position | Size | Style | Color | Blur |
| --- | --- | --- | --- | --- | --- |
| Reorganize bookmarks | left 5.6%, top 10.5% | max(20px, 2.65vw) | italic | neutral-600 | 5px |
| Reply to Sam about dinner | left 36%, top 6% | max(15px, 1.72vw) | roman | neutral-600 | none |
| Browse flights | right 7.5%, top 13.75% | max(24px, 3.1vw) | roman | neutral-500 | 7px |
| Clean out the inbox | left 11.7%, top 31% | max(16px, 1.88vw) | roman | neutral-600 | none |
| New video game? | right 9.4%, top 36% | max(17px, 2.03vw) | italic | neutral-600 | 3.5px |
| Rearrange the desk | left 3.75%, top 59% | max(26px, 3.44vw) | roman | neutral-500 | 8px |
| Watch that documentary | right 5%, top 62.5% | max(15px, 1.72vw) | roman | neutral-600 | none |
| Sort old photos | left 11%, bottom 10% | max(17px, 2.03vw) | italic | neutral-600 | 1px |
| Price new headphones | right 14%, bottom 7.5% | max(20px, 2.5vw) | roman | neutral-500 | 6px |

- Mixed blur is intentional: three words are sharp, one is barely soft, and five are heavily blurred.
- Use `filter: blur()`; no animation.

### Center column
`position: relative` (above the words), flex column, centered, gap 20px, `text-align: center`, max-width 760px.

1. **Wordmark** `h1` "Focus": heading font, weight 600, `clamp(96px, 13vw, 168px)`, line-height 0.85, letter-spacing -0.05em, `--color-text`. Plain type: **no `.cmyk-head` plate treatment** (the old login's plate effect is removed).
2. **Goals row** (margin-top 8px): flex-wrap, centered, gap `10px 28px`, 16px. Three items, each `target` icon (`--color-accent-700`) + text, gap 6px: "Ship Focus v1", "Run a half marathon", "Build an emergency fund".
   - **These are fixed illustrative copy.** The page is shown before sign-in, so never fetch or show the user's real goals here.
3. **Tagline**: "A few goals at a time. Every project and to-do traces back to one." 19px, italic, `--color-neutral-800`, `text-wrap: balance`.
4. **Form** (margin-top 20px): one row, flex-wrap, centered, gap `--space-2`, padding 10px, background `--color-bg`, radius `--radius-md`. The solid background keeps nearby words from showing through behind the fields.
   - Email `.input`, `type="email"`, placeholder "Email", `aria-label="Email"`, flex `1 1 220px`.
   - Password `.input`, `type="password"`, placeholder "Password", `aria-label="Password"`, flex `1 1 180px`.
   - `.btn .btn-primary` "Sign in", `type="submit"`, min-height 40px, padding `0 22px`, flex `0 0 auto`.
   - The visible field labels and the "Single account. Sign-up is closed." note are removed. Keep the `aria-label`s.

## Behavior
- Submit → `POST /api/v1/auth/login` (per spec) → Goals.
- Narrow screens: the goals row and the form wrap; the fields stack above the button. The words keep their percentage positions and can sit behind the center column; the form's background keeps the fields readable.

## Not in the prototype (build these)
- Error state for wrong credentials: one line under the form, 14px, `--color-accent-2-800`, `warning-circle` icon, "Email or password is incorrect." Keep the email value; clear the password.
- Rate limit (`429`): same line, "Too many attempts. Try again in a minute."
- Loading: disable the button and show "Signing in…" while the request is in flight.
- Respect `prefers-reduced-transparency` / high contrast by dropping the blur and lowering the background words to `--color-neutral-400` if needed.

## Icons
`target` (duotone).
