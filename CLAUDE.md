# Focus

Single-user planning app: AdonisJS 6 API in `api/`, React + Vite web app in `web/`.

- Spec: `docs/Focus App prototype/designhandoff/Focus App - Product & Technical Spec.md`
- Design handoff: `docs/Focus App prototype/designhandoff/README.md` (prototype: `Focus App.dc.html`). Where the README lists "Changes from the spec", the README wins; otherwise the spec wins.
- Off-track backlog, goal suggestions and calendar are built (their doc was removed; see git history). For the Calendar that doc won over `designhandoff/CALENDAR.md` (current month only, to-dos only, "+N more", click opens the to-do); CALENDAR.md is used for the look.
- Project files, recurring to-dos and multi-goal matching: `docs/Focus — Project Files, Recurring To-dos & Multi-goal Matching.md`, with UI addenda `designhandoff/LOGIN.md`, `PROJECT-FILES.md`, `RECURRING-TODOS.md`. To-dos still link to **goals only** (README "Changes from the spec" §2), so `todo_matches` only holds `goal` rows. Multi-goal colors are provisional (not designed yet; tokens `--color-match-*` in `web/src/styles/app.css`).

## Testing: don't

The user does all the testing themselves. When implementing:

- Do **not** run tests (`npm test`, `node ace test`, Japa), browser or e2e checks, screenshots, or live API probes.
- Don't write new tests unless asked.
- Writing the code and, at most, a quick typecheck (`npm run typecheck`) is enough. Then start `npm run dev` and hand over.
- Say plainly what wasn't verified.

## Conventions

- Adonis 6 (Node 22), not 7.
- The API returns snake_case JSON (`AppBaseModel`); web types in `web/src/lib/types.ts` match it.
- Every position write goes through `inList()` (advisory lock) in `api/app/services/ordering.ts`; client mutations share a per-list `scope` (`web/src/lib/optimistic.ts`).
- The AI (alignment check and goal suggestions) runs on Google Gemini (`GEMINI_API_KEY` in `api/.env`), not Anthropic. Both run in the worker (`node ace align:work`) and share one circuit breaker and spend cap.
- Run migrations with `npm run migrate`. The one Neon DB is shared with the deployed app, so keep migrations additive until the new code is deployed (the unused `todos.matched_goal_id`, `matched_project_id` and `counted` columns are waiting for a cleanup migration).
- Completions live in `todo_completions` (one row per check-off, normal or recurring); `GET /stats/completions` reads them.
- Project files are on Cloudinary (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `MAX_UPLOAD_MB` in `api/.env` and on Render). Cloudinary deletions run in the same worker (`files-delete` queue), which now starts when the AI *or* storage is configured.
