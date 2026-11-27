# Handoff: Work mode (Focus App)

Addendum to `README.md` (Global shell, Settings) and `SETTINGS.md`. Prototype: `Focus App.dc.html`. Use the Personal / Work switch next to the wordmark. The `startMode` tweak opens the prototype in Work.

## What it is
A second, separate **workspace** with its own goals (and sub-goals), projects (with tasks and files), to-dos, notes and focus-tracker history. You switch between **Personal** and **Work**. Nothing is shared between the two workspaces, and nothing from one shows up in the other.

**AI is off by default in Work.** Each workspace has its own AI setting. Turning AI on in Work needs an explicit confirmation that warns the user about sensitive work information.

## Scope: per workspace vs shared
- **Per workspace:** goals, sub-goals, projects, project tasks, project files, to-dos (incl. recurring counts), notes, the AI alignment setting (`ai_enabled`), completion stats / climb history, and AI hint runs.
- **Shared (account level):** focus limit (3/5/7), the timer and its default length, account, API keys, and the export action.
- Product question to settle with the backend: whether the focus limit should be per workspace. The prototype shares it, so the limit applies to each workspace separately (e.g. 3 active personal goals **and** 3 active work goals).

## Workspace switch (nav)
In the nav's brand area, the "Focus" wordmark becomes a flex row (`flex-wrap: wrap`, `align-items: center`, gap `10px 20px`):
- Wordmark "Focus" (unchanged: heading font 48px / 600 / line-height 1 / letter-spacing -0.03em).
- `.seg` radiogroup, `aria-label="Workspace"`, with two `.seg-opt` options at 14px: **Personal**, **Work**. The current workspace is checked.

On switch:
- Swap every per-workspace query to the other workspace. Nav counts (Goals, To-dos, Projects, Notes), the dateline ("{n} open to-dos", "{n} flagged"), the calendar and the tracker all reflect the current workspace only.
- Stay on the same page. Project detail falls back to the Projects list, because the open project belongs to the other workspace.
- Reset local UI state tied to items: open project / note, note search, expanded rows, link picker, open "Help me start" cards, goal details toggles, sub-goal inputs, the new-goal input, the new to-do input, and the project goal filter (back to "All goals").
- Remember the last workspace per user (`settings.last_workspace`, or `localStorage` if you'd rather keep it client-only) and open there on next sign-in.
- No toast.

## AI behavior in Work
When Work's `ai_enabled` is false (the default), behavior is the same as AI off today (README → Interactions): no alignment checks, no goal chips, no blur or tint, no flagged count, no "Help me start" button, and completions aren't counted in the tracker ("The AI check is off, so new completions aren't being counted."). **No Work content is sent to the AI service.** The backend must enforce this too; don't rely on the UI.

### Settings → AI alignment check
- h3 becomes "AI alignment check" followed by `.tag .tag-neutral` showing the current workspace ("Personal" / "Work"). The h3 is a flex row, `flex-wrap: wrap`, `align-items: center`, gap 10px.
- Existing description paragraph unchanged.
- **Work only**, an extra paragraph below it (same style, max 58ch, `--color-neutral-800`):
  "Personal and Work each have their own setting. AI is off by default in Work, so nothing from this workspace leaves Focus unless you turn it on."
- **Work with AI on**: a reminder line under that (`role="note"`, flex, align start, gap 8px, max 58ch, 14px, `--color-accent-2-800`), with a `warning` 18px icon (flex none, margin-top 1px):
  "AI is on for Work. Keep confidential, client and other sensitive work information out of Focus."
- `.seg` On / Off as before, bound to the current workspace's setting.

### Turn-on confirmation (Work only)
Selecting **On** while in Work doesn't change the setting. It opens the standard confirmation dialog (`.dialog-backdrop` + `.dialog`):
- Title: **Turn on AI for Work?**
- Body: "Your work to-dos, goals, projects and sub-goals will be sent to an AI service to check alignment and suggest first steps. Don't enter confidential, proprietary, client or personal data, or anything your employer doesn't allow in outside tools. You're responsible for what you add; Focus isn't responsible for work information you choose to share."
- Actions: ghost **Cancel** (leaves AI off, and the radio stays on Off), primary **I understand, turn on AI**.
- On confirm: set Work `ai_enabled = true`, mark all non-manual, non-dismissed work to-dos `pending`, and run the batch alignment check (same as turning AI on today).
- Record the acknowledgement server-side (`work_ai_ack_at` timestamp + user id) for legal reasons. Show the dialog **every time** AI goes from Off to On in Work, not only the first time.
- Turning AI **off** in Work, and any AI change in Personal, needs no confirmation.

Have legal review the dialog copy before launch. The prototype's wording is a starting draft.

## Data model / API (suggested; backend wins if it already defines this)
- New `workspaces` table: `id`, `user_id`, `kind` (`personal` | `work`), `ai_enabled` (personal default `true`, work default `false`), `work_ai_ack_at` (nullable). Create both rows at sign-up. Existing data migrates to the personal workspace.
- Add `workspace_id` (FK, not null) to `goals`, `projects`, `todos`, `notes`, and the completion-stats source. Sub-goals, tasks and files inherit through their parent.
- Scope every list/create endpoint by workspace, either with the `X-Focus-Workspace: personal|work` header or by `/api/v1/workspaces/:kind/...`. Pick one, and default to personal when it's missing so existing API scripts keep working.
- `PATCH /workspaces/work { ai_enabled: true, acknowledged: true }`: reject `ai_enabled: true` without `acknowledged: true` (`422 ack_required`).
- The alignment worker and the hint endpoint check the to-do's workspace `ai_enabled` before any AI call, and return `409 ai_disabled` otherwise.
- The goal-limit check (`409 goal_limit_reached`) counts active goals **within the workspace**.
- API keys: add a workspace restriction to keys (`workspaces: ['personal']` by default, opt in to `work`) so a personal script can't read work data unless allowed. Not in the prototype UI yet; flag it if it's needed for v1.

## Export
"Export all" downloads both workspaces in one file:
```json
{ "exported_at": "…", "settings": { "focus_limit": 3 },
  "personal": { "ai_enabled": true, "goals": [], "projects": [], "todos": [], "notes": [] },
  "work":     { "ai_enabled": false, "goals": [], "projects": [], "todos": [], "notes": [] } }
```
Settings → Data copy: "Download goals, projects, to-dos and notes from Personal and Work as JSON."

## Client state
- `workspace: 'personal' | 'work'`, in TanStack Query keys for every per-workspace query: `['todos', workspace]`, `['goals', workspace]`, etc. Switching then just changes the key, and both caches stay warm.
- AI setting is read from `['workspace', workspace].ai_enabled`, not the global settings.
- Confirm-dialog state reuses the existing `confirm` object.

## Sample work data (prototype only)
Goals "Launch the new onboarding flow by March" and "Move the team to weekly releases"; projects "Onboarding redesign" and "Q1 planning"; 4 to-dos (one recurring: "Send the weekly release notes"); 2 notes. All to-dos have no alignment because AI is off.
