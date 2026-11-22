# Focus

Single-user planning app: AdonisJS 6 API in `api/`, React + Vite web app in `web/`.

- Spec: `docs/Focus App prototype/designhandoff/Focus App - Product & Technical Spec.md`
- Design handoff: `docs/Focus App prototype/designhandoff/README.md` (prototype: `Focus App.dc.html`). Where the README lists "Changes from the spec", the README wins; otherwise the spec wins.
- Off-track backlog, goal suggestions and calendar: `docs/Focus — Off-track Backlog, Goal Suggestions & Calendar.md`. For the Calendar this doc wins over `docs/Focus App prototype/designhandoff/CALENDAR.md` (current month only, to-dos only, "+N more", click opens the to-do); CALENDAR.md is used for the look.

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
- Run migrations with `npm run migrate`.
