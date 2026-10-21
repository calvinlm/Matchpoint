# Matchpoint

Match control for pickleball tournaments: a tournament director (TD) runs divisions, brackets, courts and scoring; players and spectators follow along on public pages. Competitive edge: multi-division, multi-court events run live from one screen, plus a no-install player view.

## Layout

- `server/` — Express 5 API, CommonJS, Prisma 7 (`@prisma/adapter-pg`) on Postgres. Entry `server.js` → `app.js`.
  - `src/routes/` thin HTTP handlers · `src/services/` all logic (scheduling, scoring, seeding, matchGeneration, standings, audit) · `src/config/` validation and CORS · `prisma/` schema, migrations, seeds
- `frontend/` — Next.js 16 App Router, React 18, TypeScript, Tailwind, TanStack Query.
  - `/td/[slug]/…` director console (auth) · `/public/[slug]/…` player/spectator pages (players, standings, table = queue, brackets; `?kiosk=1` auto-refresh)
  - API calls in `src/lib/api/`, React Query hooks in `src/hooks/`
- Hosting: Vercel (frontend), Render (API, one long-running process), Supabase (Postgres, session pooler port 5432).

## Commands

Node **24.x** everywhere (`fnm use 24`). After switching Node: delete `node_modules`, `npm ci` (server `postinstall` runs `prisma generate`).

Server (`cd server`):
- `npm run dev` — API on :8080
- `npm test` — Jest, unit + integration. Needs `server/.env.test` (copy `.env.test.example`) pointing at a disposable DB whose name contains `test`; `tests/setup.js` refuses anything else because the suite truncates every table.
- `npx prisma migrate deploy` / `npx prisma migrate dev --name <name>` — migrations
- `npm run prisma:seed` — admin login; requires `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` (12+ chars), no defaults
- `npm run seed:qa` — recreates "QA Test Open 2026" (2 courts, 6 teams, seeded round robin) at `/td/qa-test-open-2026`

Frontend (`cd frontend`): `npm run dev` (:3000) · `npm run lint` · `npx tsc --noEmit` · `npm run build`

CI (`.github/workflows/ci.yml`) runs server tests on Postgres 16 and frontend lint, types and build on every PR. Keep it green.

## How we work

- One branch and one PR per task, named by its ID: `fix/p1-1-persist-live-state`, `feat/qa-8-court-board`. Small commits.
- Before every commit: `npm test` in server; `npm run lint && npx tsc --noEmit` in frontend when it changed.
- Logic goes in services, not routes. Throw `Object.assign(new Error(msg), { status })`; routes map `status` to the response.
- Every change to matches, scores, seeding or courts writes an audit entry (`recordAuditLog`, inside the same transaction).
- Any check-then-write (court free? match unscored?) happens inside the Prisma transaction.
- New scheduling, scoring or seeding logic needs unit tests; flows need an integration test through the API (`tests/helpers/api.js`).
- Error messages are for directors, not developers: "Game 1 must be won by 2, e.g. 12–10", never "games[0]".
- Migrations: one per phase where practical; never edit a migration that has run anywhere.
- Rerun `npm run seed:qa` and click through the TD console after scheduling changes.

## Definition of done

Tests for the logic · related test cases pass · every failure path shows a plain-language message · works at phone width (390 px) · audit log records the change.

## Current state (verified Oct 21, 2026 at main `07c5c36`)

Phase 0 (foundation) is done and merged (PR #7). **Next: Phase 1 — trustworthy core.** Task list, specs and acceptance tests: `docs/phase-1-plan.md`; phase checklist: `ROADMAP.md`. Work in order; P1-1 comes first because everything else builds on it.

Facts as of `07c5c36` (line numbers drift as you edit; re-check before relying on them):
- Node: `.nvmrc` = `24` in both apps; `engines` = `{ node: "24.x", npm: ">=10" }`; no `engineStrict`.
- Tests: Jest `^30.5.2` is installed in `server/`. Suite: `tests/setup.js`, `tests/helpers/{api,db}.js`, `tests/unit/{scoring,bracketConfigValidation,cors}.test.js`, `tests/integration/roundRobin.test.js` (38 tests).
- `frontend/src/lib/auth/routes/` no longer exists (removed in `9acd9f9`). Bracket config validation lives in `server/src/config/bracketConfigValidation.js`, required by `server/src/routes/brackets.js`.

Known gaps pinned by tests on purpose (flip them when fixed):
- `tests/unit/scoring.test.js` "currently accepts a game that never reached 11 (B8)"
- `tests/integration/roundRobin.test.js` re-scoring returns 409 (B2, no score correction)

Watch out for:
- **Live state is in the database** (P1-1, migration `persist_live_state`): `Match.status` (`MatchStatus`), `queueOrder`, `startedAt`, `completedAt`, `Bracket.queuePaused`. There are no in-memory Maps; `grep -n "Overrides\|Override(" server/src` must stay empty.
  - Queue order is `queueOrder ASC NULLS LAST, createdAt ASC` (`compareQueueOrder` in `scheduling.js`). Reorder renumbers the bracket's queue by 1000s until P1-3.
  - Responses still carry an integer `priority` (queue length − index) because the client's zod schema requires it; P1-3 switches the client to `queueOrder`.
  - Pause is per bracket and enforced in `updateMatchAssignment` (409 "This bracket's queue is paused" for queued matches; moving or clearing a match on court is allowed).
  - `round`, `groupIndex`, `heldAt`, `pinnedCourtId`, `calledAt`, `manuallyOrderedAt` exist but nothing writes them yet (P1-2, P1-3, P1-4). The client's status enum lacks `CALLED`.
- Round robin is generated by a nested loop in seed order (T1vT2, T1vT3…), so Team A plays its first five in a row. New matches have no `queueOrder`, so the queue follows that creation order until P1-2 sets it by round.
- `DOUBLE_ELIMINATION` silently uses the single-elimination generator. Elimination needs exactly `rounds[0].matchCount × 2` teams (no byes) and pairs seeds 1v8, 2v7… so 1 and 2 meet in the semis.
- `server/src/scripts/verify-tournaments.js` expects old auth env vars; the Jest suite supersedes it.

Out of scope until Phase 6 (security audit and pentest, before going live) unless asked: rotating the default admin password, turning off the Supabase Data API, backups, rate limits, token storage. Don't change production settings.

## Roadmap

`ROADMAP.md` is the phase checklist; tick items in the PR that finishes them. 0 Foundation ✓ · **1 Trustworthy core** · 2 Live court board · 3 Brackets that run themselves · 4 Multi-user and players · 5 Rotating partners · 6 Security audit and pentest.

Prototypes with measured results live in `docs/prototypes/` (picker comparison, round-robin ordering, rotating-partner scheduler). Use them as references for P1-2, P1-4 and Phase 5.
