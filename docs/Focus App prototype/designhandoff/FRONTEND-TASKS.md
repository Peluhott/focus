# Frontend tasks (start here)

Work list for this round, in build order. Each item points to the addendum with the full UI spec. Visual values come from `README.md` → Design Tokens and `_ds/.../styles.css`. Prototype: `Focus App.dc.html` (open in a browser from this folder).

Type and endpoint shapes below are what the prototype assumes. **If the backend already defines them, the backend wins**; adjust the UI wiring, not the API.

## 1. Types — `web/src/lib/types.ts`
```ts
export interface Note {
  id: number
  title: string          // '' allowed; list shows "Untitled note"
  body: string           // markdown
  position: number       // manual order
  created_at: string
  updated_at: string     // list shows "Today" or "Nov 18"
}

export type TodoHintStatus = 'queued' | 'running' | 'ready' | 'error'
export interface TodoHintRun {
  id: number
  todo_id: number
  status: TodoHintStatus
  text: string | null     // ONE concrete first step (see START-SMALL.md)
  steps?: string[] | null // if the backend still returns steps, the UI uses text, else steps[0]
  error: string | null
  created_at: string
}

// additions
interface User     { /* … */ display_name: string }
interface Settings { /* … */ timer_minutes: number }  // 1–180, default 25
```

## 2. Settings — Account form → `SETTINGS.md`
Display name, email, current password, new password. `PATCH /account`. Account is now the **first** section on Settings.

## 3. Settings — Timer default → `SETTINGS.md`
Number field bound to `settings.timer_minutes`.

## 4. Nav-bar timer → `NAV-AND-TIMER.md`
Start / pause / reset, click the time to type minutes, sound at 0, then "Again" or "New". End time in `localStorage`.

## 5. Notes page → `NOTES.md`
Route `/notes`, nav link, `web/src/lib/notes.ts` hooks. Search, autosaving editor (same pattern as `NotesField`), drag to reorder using the **shared per-list scope in `optimistic.ts`**, delete with Undo.

## 6. "Help me start" on a to-do → `START-SMALL.md`
Replaces the earlier hint-panel idea. One button per row; shows one small first step. Polls `GET /todos/:id/hint` while queued/running. "Another idea" sends `force: true`. "Add as to-do" inserts the step above the to-do. Hidden when AI is off.

## 7. API keys — scopes
If `ApiKeys.tsx` / `keys.ts` keep their own scope list, add `notes:read` and `notes:write` after the to-do scopes:
```
goals:read  goals:write  projects:read  projects:write  todos:read  todos:write  notes:read  notes:write
```
Scope checkboxes sit in a grid `repeat(auto-fill, minmax(150px, 1fr))`, labels in monospace 12px.

## 8. To-dos layout change → `RECURRING-TODOS.md` § Recurring band
Add box first, then recurring to-dos grouped in a tinted "Recurring" band, then one-time to-dos.

## 9. Work mode → `WORK-MODE.md`
Second workspace with its own goals, projects, to-dos and notes. A Personal / Work `.seg` sits next to the wordmark. Put `workspace` in every per-workspace query key. AI is per workspace and off by default in Work, and turning it on in Work needs the warning dialog plus a server-side acknowledgement.

## 10. Small changes elsewhere
- **Nav bar is two rows** (`NAV-AND-TIMER.md`). Nav order: Goals, To-dos, Projects, Notes, Calendar, Settings.
- **Focus tracker:** remove the "Off-goal" row from "Completed to-dos by goal". The heading total and bar widths use only goal-linked completions, so bars sum to 100%.

## Login & sign-up
See `LOGIN-SIGNUP.md`.
- [ ] Splash: replace the email/password form with **Log in** (primary) and **Sign up** (secondary) buttons.
- [ ] Auth panel: split layout, `authMode` login/signup, mode switch, Back to splash.
- [ ] Single sign-on: Google, Microsoft, Apple (OAuth/OIDC); first sign-in creates the account.
- [ ] Email sign-up: Name field, `POST /api/v1/auth/signup`, validation, error and loading states.
- [ ] Feature overview aside with the two static previews (Every to-do checked, Help me start).
- [ ] "Forgot it?" link (reset flow not designed yet).

## To-do completion animation
See `TODO-COMPLETE.md`.
- [ ] +1 rise, strike-through, and fold-away before removal. Toast after removal.
- [ ] "Done today" count with bump.
- [ ] Reduced-motion fallback.

## Search
See `SEARCH.md`.
- [ ] Date-line trigger, ⌘K and / shortcuts.
- [ ] Command palette: grouped results, highlight, keyboard nav, quick actions, "Add as a to-do".
- [ ] Search endpoint scoped to the workspace.

## Undo
See `UNDO.md`.
- [ ] Remove delete confirm dialogs (goal, project, file).
- [ ] Stacking toast: 10 s, pause on hover, progress bar, Undo all, ⌘Z.
- [ ] Soft-delete with purge on the server.

## Feedback
See `FEEDBACK.md`.
- [ ] Corner Feedback button and search quick action.
- [ ] Feedback form with type, feature preset, message, screenshot, contact opt-in, sent state.
- [ ] `POST /api/v1/feedback` and the error state.
