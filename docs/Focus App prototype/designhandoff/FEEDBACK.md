# Handoff: Send feedback (Focus App)

Addendum to `README.md`. Explored in `Feedback Ideas.dc.html`. The chosen design is trigger **1b** (a corner button) with form **2a**.

## Corner button
- `.btn .btn-secondary` with a `chat-circle-text` icon (18px) and the label "Feedback", gap 8px.
- Fixed bottom-right (`right: clamp(20px, 5vw, 64px); bottom: 24px`), z-index 39, `--color-bg` fill, `--shadow-md`.
- Shown on every app page. Hidden on the login screens and while the form is open.
- The toast sits bottom-left, so they don't collide.
- Also available as the "Send feedback" quick action in the search palette.

## Form (modal)
- **Backdrop:** fixed, z-index 50, `--color-text` at 28%. Clicking it closes the form.
- **Dialog:**
  - Fixed, z-index 51, centered, `top: 8vh`, width `min(480px, 100vw - 32px)`, max-height 84vh (scrolls).
  - Padding `--space-6`, gap `--space-4`. `--color-bg`, `--shadow-lg`, `--radius-lg`.
  - `role="dialog"`, `aria-modal`. Esc closes.
- **Contents, top to bottom:**
  1. **Header:** h3 "Send feedback" and an italic 14px neutral-700 line, "Ideas, bugs, or anything else.", with a close (×) icon button on the right.
  2. **Type:** `.seg` radios, 8px 14px, 14px, each with an icon. Idea (`lightbulb`, default), Something's broken (`bug`), Other (`chat-circle`).
  3. **Feature:** `.field` with a select. Options: General, Goals, To-dos, Projects, Notes, Calendar, Timer, Search, Help me start, Off-goal flags, Settings.
     - Preset from the page: Goals, To-dos, Projects (list or detail), Notes, Calendar, Settings. Anything else gets General.
  4. **Message:** `.field` textarea, 4 rows, 15px, autofocused. Placeholder by type:
     - Idea: "What would make Focus better for you?"
     - Something's broken: "What happened, and what did you expect?"
     - Other: "Anything on your mind."
  5. **Screenshot** (Something's broken only): a ghost "Attach a screenshot" button (`paperclip`). Once attached, it becomes a row with an `image` icon, the file name and a remove (×) button.
  6. **Contact:** checkbox, on by default. "OK to email me about this at {email}".
  7. **Actions,** right-aligned: Cancel (ghost) and Send (primary, `paper-plane-tilt`). Send stays disabled until the message has text.
- **Sent state** (replaces the form):
  - `check-circle` icon (36px, `--color-accent-700`) and h3 "Thanks, {name}."
  - Line: "Your note about {Feature} was sent." If contact is on, add "If there are questions, a reply will come to {email}."
  - A Close button (secondary, focused).

## Data to send
`POST /api/v1/feedback` with:
- `type`: idea | bug | other
- `feature`, `message`, `contact_ok`
- `screenshot`: optional upload
- `page`, `workspace`
- `app_version`, `user_agent`

Not built in the prototype: sending, the screenshot upload (it's a placeholder), and the error state. For a failed send, keep the form and show "Couldn't send. Try again." above the actions in `--color-accent-2-800`.

## Files
`Focus App.dc.html`: `feedbackView()` and the `feedback` state.
