# Focus App — Product & Technical Spec

Nov 20, 2026 · @jav

## Overview

Focus is a personal planning app that caps how many goals can be active at once (3, 5 or 7), ties projects and to-dos back to those goals, and highlights in red any to-do that doesn't serve a goal or project.

The problem it solves: work is spread across too many things, and Todoist captures everything without pushing back. Focus is built to push back, gently.

**Guiding principles**

- **Focus over capture.** The goal cap is enforced, not a suggestion.
- **Everything traces up.** Sub-goals live in goals, tasks live in projects, and to-dos are checked against both.
- **The to-do list stays fast.** Type, press Enter, drag. Dates are optional.
- **API-first.** Anything the web app can do, an API key can do.
- **AI advises, never blocks.** A red highlight is a nudge; saving never waits on the model.

## Scope and assumptions

Version 1 is a deployed, single-user app with a login, a web UI for three pages (Goals, Projects, To-dos), a REST API driven by API keys, and the AI alignment check on to-dos.

**Assumptions**

- One account. Sign-up is disabled once the first account exists (or the account is seeded from environment variables at deploy).
- Publicly reachable, so login, HTTPS and rate limiting are required from day one.
- REST API only. No MCP server in v1; the OpenAPI spec keeps that door open.

**Out of scope for v1**

- Multiple users, sharing or teams
- Native mobile apps (the web UI should still work on a phone)
- Reminders, notifications and calendar sync
- Recurring to-dos
- MCP server
- Offline mode

## Data model

Eight tables. Goals own sub-goals, projects can optionally link to a goal, projects own tasks, and to-dos stand alone until the AI (or you) links them to a goal or project.

| Entity | Key fields | Notes |
| --- | --- | --- |
| User | id, email, password\_hash, focus\_limit (3, 5 or 7, default 3), created\_at | Single row in v1 |
| Goal | id, title, details (markdown), status (active, completed, archived), position, completed\_at | Only `active` goals count toward the limit |
| SubGoal | id, goal\_id, title, details (markdown), done, position | Ordered checklist inside a goal |
| Project | id, title, details (markdown), status (planning, active, on\_hold, done, archived), goal\_id (nullable), due\_date (nullable), position | Goal link is optional |
| Task | id, project\_id, title, details, status (pending, complete), due\_date (nullable), position, completed\_at | Belongs to one project |
| Todo | id, title, notes, date (nullable), position, done, done\_at, alignment\_status, alignment\_reason, matched\_goal\_id, matched\_project\_id, alignment\_source (ai, manual), checked\_at | `alignment_status`: pending, aligned, unaligned, dismissed, error |
| ApiKey | id, name, prefix, token\_hash, scopes, last\_used\_at, expires\_at (nullable), revoked\_at | Plain key shown once, only the hash is stored |
| AlignmentCheck | id, todo\_id, model, context\_version, verdict (JSON), input\_tokens, output\_tokens, latency\_ms, created\_at | Audit log for cost tracking and evals |

`position` columns use fractional indexing (a sortable string key), so moving an item writes one row instead of renumbering the list. All tables also carry `created_at` and `updated_at`.

## Goals page

A focus-limit dropdown (3, 5 or 7) sets how many goals can be active at once; when you hit the limit, you can't add another until you complete, archive or raise the limit.

**Focus limit**

- Dropdown at the top of the page, labelled "Active goals: 3 / 5 / 7". Default is 3.
- Header shows usage, e.g. "2 of 3 active goals".
- At the limit, the "New goal" button is disabled with the message: "You're at your limit. Complete or archive a goal, or raise your limit." The API returns `409 goal_limit_reached`.
- Lowering the limit below your current active count is blocked. Options under that count are greyed out, with a hint like "Archive 2 goals to drop to 3".
- Restoring an archived goal to active follows the same limit check.

**Goal cards**

- Title, details (markdown editor, collapsed by default), progress bar (sub-goals done / total), and the count of linked projects.
- Drag and drop to reorder goals.
- Actions: Complete, Archive, Delete (with confirmation). Completing a goal removes it from the page (with a 5-second Undo) and frees a slot under the limit. Archived goals sit in a collapsed "Archived" section and can be restored.

**Sub-goals**

- A checklist inside each goal: add with Enter, check off, drag to reorder.
- Each sub-goal expands to show its own markdown details.
- No limit on sub-goals; the cap applies to top-level goals only.

## Projects page

Projects have a list view to scan everything and a detail view that holds the project's notes and its task list; linking a project to a goal is optional.

**List view**

- One row per project: title, status, linked goal (if any), open-task count, next due date.
- Filter by status and by goal; "Archived" hidden by default.
- Drag to reorder. "New project" opens the detail view with an empty title.

**Detail view**

- Title, status dropdown, linked-goal dropdown (active goals only, or "None"), optional due date.
- Details area in markdown for the overview, links, decisions and notes.
- Task list below the details.

**Tasks**

- The task list has two sections: **Pending** and **Complete**.
- Add a task with Enter. Each task has a title, optional details and an optional due date.
- Checking a task moves it to the top of Complete. Unchecking moves it back to Pending. Completed tasks never disappear; they stay as a record of what's been done.
- Drag to reorder within Pending.
- Tasks stay in their project and are never copied to the to-do list. They're for tracking the project and give the AI context: to-dos are compared against pending tasks.
- Tasks themselves are not AI-checked.

## To-do page

Every to-do lives on one page in one list, in the order you drag it into. There are no Today, upcoming or date-based views.

- **Quick add.** A single input at the top. Enter adds the item to the top of the list and clears the input, so you can keep typing.
- **Drag and drop.** The order you set is the only order; nothing re-sorts the list automatically. Works with mouse, touch and keyboard (dnd-kit). The UI updates instantly; one `PATCH` saves the new position.
- **Optional date.** A small calendar button on each item. A dated item shows a date chip; overdue chips turn amber (red is reserved for the AI check). Dates are informational only and never move or group items.
- **Edit inline.** Click the text to edit; an optional notes field expands below it.
- **Complete.** Checking an item removes it from the page, with a 5-second Undo toast. It stays in the database marked done, but never shows in the UI again.
- **Alignment state.** Each item shows its AI result (next section): nothing while checking, a small goal or project chip when aligned, red when unaligned.

## AI alignment check

Every open to-do is compared with your active goals and projects. If it doesn't clearly serve any of them, it's highlighted red with a one-line reason, and you can dismiss or relink it.

**Optional by design**

The AI check is an extra. Every page, every API endpoint and every save works the same whether it's running, broken or turned off.

- **On/off switch.** `AI_ENABLED` env var plus a toggle in Settings. If no LLM key is set, it's off automatically. When it's off, nothing is queued, `alignment_status` stays `null`, and the UI shows no spinners, chips or red highlights.
- **Saves never depend on it.** The to-do is committed first; queuing the check happens after the commit, inside a try/catch. If queuing fails, the error is logged and the save still returns `201`.
- **Separate process.** The worker runs apart from the API. If it crashes or is stopped, the API and web app keep running; queued checks wait until it comes back.
- **Hard timeouts.** Each model call times out after 10 s and retries at most twice with backoff, then marks the to-do `error` (neutral, no highlight).
- **Circuit breaker.** After 5 failures in a row, checks pause for 15 minutes instead of hammering a down provider. Same when the monthly spend cap is hit.
- **No AI in the critical path.** Health checks, login, reads and drag-and-drop never call the model. Removing the AI code entirely would leave a fully working app.
- **Built last.** The AI is Phase 6, so the app is complete and in daily use before it exists.

**When it runs**

- When a to-do is created (from the UI or the API) and when its title or notes change. Edits wait 1.5 s after you stop typing, then run.
- When a goal, sub-goal or project is created, edited or archived: open to-dos are re-checked in one batched job (debounced, so editing a goal doesn't fire ten jobs).
- The check runs as a background job. Saving the to-do never waits on it.

**What the model sees**

- The to-do's title and notes.
- Each active goal: title, details trimmed to a set length, and sub-goal titles.
- Each project with status planning or active: title, details trimmed, and pending task titles (capped).
- A `context_version` hash of that goal and project snapshot, so results can be cached and stale ones detected.

**What it returns** (structured JSON output, validated with a schema)

```json
{
  "aligned": false,
  "confidence": 0.82,
  "match": { "type": "none", "id": null },
  "reason": "Doesn't relate to any active goal or project."
}
```

**How it's shown**

| Result | Rule | Display |
| --- | --- | --- |
| Aligned | `aligned: true` | Small chip with the matched goal or project name |
| Unaligned | `aligned: false` and confidence of 0.6 or more | Red left border, light red background, warning icon, reason on hover or tap |
| Unsure | `aligned: false` and confidence under 0.6 | Treated as aligned with no chip, to avoid false reds |
| Pending or error | Job queued, or the model call failed | Neutral; error shows a small "retry" link |

Red is never the only signal: the icon and the reason text carry the meaning too.

**Overrides**

- **"This is fine"** sets `dismissed`. A dismissed to-do is not re-flagged unless its text changes.
- **"Link to…"** lets you pick a goal or project yourself (`alignment_source: manual`). Manual links are never overwritten by the AI.

**Model and prompt**

- A provider interface (`classifyAlignment(todo, context)`) so the model can be swapped. Default: a small, fast model such as Claude Haiku 5.5.
- The system prompt tells the model to judge whether the to-do directly moves a goal or project forward, to name the single best match, and to keep the reason under 140 characters.
- Each call is logged in `AlignmentCheck` (tokens, latency, verdict) for cost tracking.
- A small labelled eval set (to-dos you mark aligned or unaligned) is re-run whenever the prompt or model changes.

## REST API and API keys

The web app and your API keys call the same `/api/v1` endpoints. The web app authenticates with a session cookie, keys with a Bearer token limited by scopes.

**API keys**

- Created in Settings > API keys with a name, scopes and an optional expiry date.
- Format: `fk_` + random secret. The full key is shown once; only its hash and a short prefix (for recognising it in the list) are stored.
- List shows name, prefix, scopes, last used, expiry. Revoke takes effect immediately.
- Keys can't create or manage other keys, change the password or change the focus limit. Those need a logged-in session.
- Scopes: `goals:read`, `goals:write`, `projects:read`, `projects:write` (covers tasks), `todos:read`, `todos:write`.

**Endpoints**

| Resource | Endpoints |
| --- | --- |
| Goals | `GET /goals`, `POST /goals`, `GET /goals/:id`, `PATCH /goals/:id`, `DELETE /goals/:id`, `POST /goals/:id/complete`, `POST /goals/:id/archive`, `POST /goals/:id/restore` |
| Sub-goals | `GET /goals/:id/subgoals`, `POST /goals/:id/subgoals`, `PATCH /subgoals/:id`, `DELETE /subgoals/:id` |
| Projects | `GET /projects`, `POST /projects`, `GET /projects/:id`, `PATCH /projects/:id`, `DELETE /projects/:id` |
| Tasks | `GET /projects/:id/tasks`, `POST /projects/:id/tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id` |
| To-dos | `GET /todos`, `POST /todos`, `PATCH /todos/:id`, `DELETE /todos/:id`, `POST /todos/:id/recheck`, `POST /todos/:id/dismiss` |
| Settings | `GET /settings`, `PATCH /settings` (session only) |
| API keys | `GET /keys`, `POST /keys`, `DELETE /keys/:id` (session only) |

**Conventions**

- Reordering: `PATCH` with `{ "before_id": "…" }` or `{ "after_id": "…" }`; the server works out the new position.
- Filters: `?status=`, `?goal_id=`, `?date=`, `?done=`, `?alignment_status=`. Lists use cursor pagination (`?cursor=`, `?limit=`, max 100).
- `POST` accepts an `Idempotency-Key` header so scripts and agents can retry safely.
- Errors: `{ "error": { "code": "goal_limit_reached", "message": "…" } }`. Codes: `401 unauthorized`, `403 missing_scope`, `404 not_found`, `409 goal_limit_reached`, `422 validation_error`, `429 rate_limited`.
- Rate limit: 120 requests per minute per key; login limited to 5 attempts per minute.
- An OpenAPI spec is generated from the route validators and served at `/api/v1/openapi.json`.

**Example**

```bash
curl -X POST https://focus.example.com/api/v1/todos \
  -H "Authorization: Bearer fk_…" \
  -H "Content-Type: application/json" \
  -d '{"title": "Write project README", "date": "2026-11-21"}'
```

The response returns the to-do with `alignment_status: "pending"`; fetch it again (or list with `?alignment_status=unaligned`) to see the result.

## Architecture and tech stack

A TypeScript stack: a React single-page app and an AdonisJS API over Postgres, with AI checks run by a background worker so saving stays instant.

&#91;embedded content: architecture · 6 components\]

The API saves the to-do and queues a check in Postgres. The worker sends it to the model and writes the verdict back; the web app polls pending to-dos every 2 s until they resolve.

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React + Vite, TanStack Query, dnd-kit, Tailwind | App behind a login, so no SEO or server rendering needed; dnd-kit handles mouse, touch and keyboard dragging |
| Backend | AdonisJS 6 (TypeScript), VineJS validators, Lucid ORM | Built-in session auth plus hashed access tokens with abilities, which map directly to API keys and scopes |
| Database | Postgres | Relational data with ordering and foreign keys |
| Jobs | pg-boss (queue stored in Postgres) | Background checks and retries without running Redis |
| AI | Anthropic SDK behind a provider interface | Structured JSON output; model can be swapped |
| Ordering | `fractional-indexing` package | One-row writes on drag and drop |
| Secrets | Environment variables | Can move to a dedicated secrets store later |

Hosting is handled separately and is outside this spec.

## Non-functional requirements

**Security**

- Passwords hashed with scrypt or argon2 (AdonisJS hash). Login rate-limited.
- HTTPS only; session cookies `HttpOnly`, `Secure`, `SameSite=Lax`; CSRF protection on session routes.
- CORS limited to the web app's origin. API keys hashed at rest, scoped, revocable, never logged.
- LLM provider key held server-side only, in environment variables at first.

**Performance**

- Adding, editing, checking off and reordering feel instant (optimistic UI; the server confirms in the background).
- Pages load in under 1 s on a normal connection with a few hundred items.

**Cost**

- Runs on free or near-free tiers.
- A monthly AI spend cap (`AI_MONTHLY_BUDGET_USD`). Over the cap, checks pause and to-dos stay neutral.
- Results cached by to-do text plus `context_version`, so unchanged items aren't re-sent.

**Data safety**

- Nightly `pg_dump` to object storage, kept 30 days.
- "Export all" in Settings downloads everything as JSON.

**Accessibility**

- Drag and drop has a keyboard alternative. The red flag always comes with an icon and text, never colour alone.

## Build phases

Six phases, each shipped to production before the next starts. Every phase builds its endpoints and its UI together, since the web app uses the same API.

1. **Foundation.** Repo, AdonisJS API, React app, Postgres schema and migrations, single-account login, deploy pipeline, backups.
   - Done when: you can log in on the deployed URL.
2. **To-do page.** To-do CRUD, quick add, drag and drop, optional dates, complete removes from the page.
   - Done when: it replaces Todoist for your to-dos.
3. **Goals.** Focus-limit setting, goal CRUD with the limit enforced, sub-goals, progress.
   - Done when: a 4th goal is blocked at limit 3, in both the UI and the API.
4. **Projects and tasks.** List and detail views, goal linking, tasks.
   - Done when: current projects are moved in.
5. **API keys.** Key management UI, scopes, rate limiting, idempotency, OpenAPI spec.
   - Done when: a script creates a project and a to-do with a scoped key.
6. **AI alignment check.** Job queue, worker, provider interface, red highlight, overrides, re-check on goal or project changes, spend cap, eval set.
   - Done when: the eval set passes and real to-dos flag as expected for a week.

The to-do page comes before Goals so the app is useful from week one; the AI check comes last because it needs goals and projects to compare against.
