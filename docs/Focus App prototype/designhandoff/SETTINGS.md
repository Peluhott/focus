# Handoff: Settings (Focus App)

Replaces `README.md` §6. Left-aligned column, max-width 720px, gap 40px. h1 "Settings".

**Section order:** Account, AI alignment check, Timer, API keys, Data. Each section starts with an h3.

## 1. Account
Form: grid, gap 15px, max-width 520px.
- `.field` "Display name" → `user.display_name` (`autocomplete="name"`).
- `.field` "Email" (`type="email"`, `autocomplete="email"`).
- Two fields side by side (grid `repeat(auto-fit, minmax(200px, 1fr))`, gap 15px): "Current password" (`autocomplete="current-password"`), "New password" (`autocomplete="new-password"`, placeholder "Leave blank to keep").
- Help line (13px, neutral-700): "Changing your email or password needs your current password. New passwords are at least 8 characters."
- Error line when present: `role="alert"`, `warning-circle` 18px + message, 14px, `--color-accent-2-800`.
- Actions row (flex-wrap, gap `10px 15px`, margin-top 5px): `.btn-primary` "Save changes" ("Saving…" while pending; disabled until something changed or while saving); after success `check` "Saved" (14px, accent-700, `role="status"`, clears after 3 s or on the next edit); ghost `sign-out` "Sign out" pushed right (`margin-left: auto`).

**Client validation (in this order, first failure shown):**
1. Display name empty → "Display name can't be empty."
2. Invalid email → "Enter a valid email address."
3. Email changed or new password set, no current password → "Enter your current password to change your email or password."
4. New password < 8 chars → "New password must be at least 8 characters."

**Submit:** `PATCH /account` with only changed fields: `{ display_name?, email?, current_password?, new_password? }`. On success update the user query, clear both password fields. On a server error (e.g. wrong current password, email taken) show its message in the error line. Editing any field clears the error.

## 2. AI alignment check
Unchanged: copy "Compares each open to-do with your active goals, and blurs the ones that don't serve any of them. When it's off, nothing is checked and no chips or highlights show." + `.seg` On / Off. Off also hides "Help me start".

## 3. Timer
- Copy (neutral-800, max 58ch): "The timer in the nav bar starts from this length. When it ends, you can run it again or pick a different length for that run."
- `.field` (max-width 220px) "Default length (minutes)": number input, min 1, max 180, step 1, width 120px → `settings.timer_minutes`. Save on blur (clamp to 1–180; empty or invalid reverts). Updates the nav timer if it's idle.

## 4. API keys
Unchanged, except scopes now include `notes:read` and `notes:write` (see `FRONTEND-TASKS.md` §7).

## 5. Data
Unchanged: "Download all goals, projects, tasks and to-dos as JSON." + `.btn-secondary` `download-simple` "Export all".
