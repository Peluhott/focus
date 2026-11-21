# Focus

A personal planning app that caps how many goals are active at once and ties projects and to-dos back to them.

- Spec: `docs/design_handoff/Focus App - Product & Technical Spec.md`
- Design handoff: `docs/design_handoff/README.md` (open `Focus App.dc.html` for the prototype)

## Layout
- `api/`: AdonisJS 6 API (`/api/v1`) on Neon Postgres
- `web/`: React + Vite + TanStack Query + dnd-kit + Tailwind, styled with Broadsheet

## Local setup
1. Fill in `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `api/.env`. The account is created on the first boot, when no user exists yet.
2. Run `npm install` in the root, in `api/` and in `web/`.
3. Run `npm run migrate`. It uses the direct (unpooled) Neon connection.
4. Run `npm run dev`. The API runs on :3333 and the web app on http://localhost:5173 (Goals is the start page). Vite proxies `/api`; set `FOCUS_API_URL` to point a second Vite at another API.

## Checks
- `npm test`: Japa tests, run against the Neon `test` branch (`api/.env.test`)
- `npm run typecheck`
- `npm run lint`

## Database
The Neon project is `focus` (`flat-leaf-07056874`, aws-us-west-2, PG 18):
- branch `main`: dev
- branch `test`: tests

`DATABASE_URL` is the pooled connection; `DATABASE_URL_DIRECT` is for migrations and, later, pg-boss.
