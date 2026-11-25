# Focus

Multi-user planning app with Personal / Work workspaces: AdonisJS 6 API in `api/`, React + Vite web app in `web/`.

- Spec: `docs/Focus App prototype (1)/designhandoff/Focus App - Product & Technical Spec.md`
- Design handoff: `docs/Focus App prototype (1)/designhandoff/README.md` (prototype: `Focus App.dc.html`); start with `FRONTEND-TASKS.md`. Where the README lists "Changes from the spec", the README wins; otherwise the spec wins. Backend shapes win over the handoff's suggested ones (FRONTEND-TASKS.md says so).
- Sign-up is email only (no Google/Microsoft/Apple), and "Forgot it?" stays hidden until there's an email service.
- Off-track backlog, goal suggestions and calendar are built (their doc was removed; see git history). For the Calendar that doc won over `designhandoff/CALENDAR.md` (current month only, to-dos only, "+N more", click opens the to-do); CALENDAR.md is used for the look.
- Project files, recurring to-dos and multi-goal matching: `docs/Focus — Project Files, Recurring To-dos & Multi-goal Matching.md`, with UI addenda `designhandoff/LOGIN.md`, `PROJECT-FILES.md`, `RECURRING-TODOS.md`. To-dos still link to **goals only** (README "Changes from the spec" §2), so `todo_matches` only holds `goal` rows. Multi-goal colors are provisional (not designed yet; tokens `--color-match-*` in `web/src/styles/app.css`).

## Testing: don't

The user does all the testing themselves. When implementing:

- Do **not** run tests (`npm test`, `node ace test`, Japa), browser or e2e checks, screenshots, or live API probes.
- Don't write new tests unless asked.
- Writing the code and, at most, a quick typecheck (`npm run typecheck`) is enough. Then start `npm run dev` and hand over.
- Say plainly what wasn't verified.

## Conventions

- Every user has a `personal` and a `work` workspace (`workspaces` table). Goals, projects, to-dos, notes, completions, off-track items, suggestions and the AI logs carry `workspace_id`; sub-goals, tasks, files and matches go through their parent. Data routes pick the workspace from the `X-Focus-Workspace: personal|work` header (personal when missing) via `workspace_middleware` → `ctx.workspace`. Query through `inWs` / `findInWs` / `findSubGoal`… in `api/app/services/scoped.ts`, and set `workspaceId` on create. `inList()` keys include the workspace (`todos:${ws.id}`).
- Web: each workspace has its own TanStack `QueryClient` (`web/src/lib/workspace.ts`), so query keys stay workspace-free (`['todos']`) and both caches stay warm. `api.ts` sends `X-Focus-Workspace` from `currentWorkspace()`. The shell is keyed by workspace in `App.tsx`, so a switch resets local UI state, and it waits for pending mutations first. The signed-in user (`me`) lives in the root client (`lib/queryClient.ts`) and is copied into each workspace's client.
- AI on/off is per workspace (`workspaces.ai_enabled`, off by default in Work; `aiActive(workspaceId)`). Turning it on in Work needs `acknowledged: true` on `PATCH /settings` (else `422 ack_required`), logged in `ai_consents`. Focus limit, timer and API keys are per user.
- Adonis 6 (Node 22), not 7.
- The API returns snake_case JSON (`AppBaseModel`); web types in `web/src/lib/types.ts` match it.
- Every position write goes through `inList()` (advisory lock) in `api/app/services/ordering.ts`; client mutations share a per-list `scope` (`web/src/lib/optimistic.ts`).
- The AI (alignment check, goal suggestions and "Help me start" hints) runs on Google Gemini (`GEMINI_API_KEY` in `api/.env`), not Anthropic. All three run in the worker (`node ace align:work`) and share one circuit breaker, a global spend cap (`AI_MONTHLY_BUDGET_USD`) and a per-user cap (`AI_USER_MONTHLY_BUDGET_USD`, default $1).
- Postgres here defaults to port **5433**, not 5432. The Neon URLs in `api/.env` (`DATABASE_URL`, `DATABASE_URL_DIRECT`) have no port and work as is. Claude has DB access from this machine, so run migrations itself rather than handing them to the user.
- Deployment goes through the user's MCP tools (Neon, Render, Vercel, stack registry: `neon_*`, `render_*`, `vercel_*`, `stacks_*`). Use them for branches, env vars, deploys and logs instead of asking the user to do it. The stack is the protected `focus`.
- Run migrations with `npm run migrate`. The Render build also runs them on every deploy of `main` (`node ace.js migration:run --force --connection=migrator`), so a push to `main` migrates the shared DB. The one Neon DB is shared with the deployed app, so keep migrations additive until the new code is deployed. Waiting for a post-deploy cleanup migration: drop the unused `todos.matched_goal_id`, `matched_project_id`, `counted` and `users.ai_enabled`; re-backfill any null `workspace_id` (rows the old deploy wrote) to the first user's personal workspace and make it NOT NULL.
- Completions live in `todo_completions` (one row per check-off, normal or recurring); `GET /stats/completions` reads them.
- Project files are on Cloudinary (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `MAX_UPLOAD_MB` in `api/.env` and on Render). Cloudinary deletions run in the same worker (`files-delete` queue), which now starts when the AI *or* storage is configured.
