# ✅ TASKS.md — Match Point Project Tasks & Milestones

> **Workflow rules (do this every session):**
> - Always read **PLANNING.md** at the start of every new conversation.
> - Check **TASKS.md** before starting your work.
> - Mark completed tasks in **TASKS.md** immediately.
> - Add newly discovered tasks to **TASKS.md** when found.

---

## Milestone 1 — Schema & API Foundation
- [x] Define Prisma schema per PRD (Tournament, Division, Bracket, Match, Standing, Registration, Team, TeamPlayer, Player, Court) — Completed 2025-10-20 (initial Prisma models added).
 - [x] Add enums (AgeGroup, Level) and constraints (unique `slug`, unique `[divisionId, entryCode]`) — Completed 2025-10-20 (Level enum added; constraints confirmed in Prisma).
- [x] Generate initial Prisma migration; target Postgres dev DB — Completed 2025-10-20 (SQL diff generated via `npx prisma migrate diff`; run with DATABASE_URL when ready).
- [x] Seed script: create sample tournament with `plannedCourtCount` and seed courts 1..N. — Completed 2025-10-20 (`prisma/seed.js` upserts sample tournament and courts).
- [x] REST: `POST /api/v1/tournaments` (create; seed courts if `plannedCourtCount` provided). — Completed 2025-10-20 (Express route seeds courts 1..N when planned count supplied).
- [x] REST: `GET /api/v1/tournaments/:slug` and `PATCH /api/v1/tournaments/:slug`. — Completed 2025-10-20 (fetch returns courts ordered; patch seeds missing courts and supports slug update).
- [x] Add integration tests for tournament API (Jest + Supertest). — Completed 2025-10-20 (requires running Postgres instance for test DB).
- [x] Add minimal TD auth (NextAuth: credentials or magic link). — Completed 2025-10-20 (Express credential login issuing JWT; protects tournament writes).
- [x] Implement audit log model & middleware to capture write actions. — Completed 2025-10-20 (Prisma `AuditLog` model + logging on create/update).
- [x] CI: add schema validation and typecheck workflows (GitHub Actions). — Completed 2025-10-21 (`.github/workflows/ci.yml` runs Prisma checks and integration tests against Postgres).

## Milestone 2 — Import Engine
- [x] Build consolidated CSV parser (Papaparse) and dedupe logic (players, teams, registrations). — Completed 2025-10-21 (`src/import/csvImporter.js` with Papaparse + unit tests).
- [x] Implement `Registration.entryCode` generator `{age}{division}{level}_{seq}` with per-division counter. — Completed 2025-10-21 (`src/import/entryCode.js` + tests).
- [x] REST: `POST /api/v1/tournaments/:slug/import` (single-sheet CSV). — Completed 2025-10-21 (CSV parsing, dedupe, transactional import, audit log).
- [x] Validation & error reporting (row-level feedback). — Completed 2025-10-21 (returns 422 with row-level errors before import).
- [x] Unit tests for dedupe and entry code generation. — Completed 2025-10-21 (Jest coverage for parser, entry codes, and import endpoint).
- [x] Docs: add CSV sample and field mapping in `/docs/import.md`. — Completed 2025-10-21.

## Milestone 3 — Bracket Engine
- [x] Create bracket creation UI (single/double elim; optional RR). — Completed 2025-10-23 (division page form + React Query hooks).
- [x] Support `config` JSON (`rounds`, `groups`, `bestOf`, `winBy2`, `finalsReset`, `rr.groupSize`). — Completed 2025-10-21 (`src/brackets/configValidation.js` validates config per type).
- [x] Enable multiple brackets per division and custom group splits. — Completed 2025-10-21 (API allows creating multiple brackets per division with managed config).
- [x] Drag-and-drop team placement & reseeding; persist order. — Completed 2025-10-24 (Bracket seeding board saves order via `/seeding`)
- [x] Lock/unlock brackets; prevent edits when locked. — Completed 2025-10-21 (`PATCH /brackets/:id` supports locking and rejects config changes).
- [x] Unit tests for bracket generation pathways. — Completed 2025-10-21 (Bracket config validators + integration tests in `tests/brackets.integration.test.js`).
- [x] Frontend: bracket creation/edit UI (form + list) consuming new endpoints. — Completed 2025-10-23 (panel form, lock toggle, seeding board).
- [x] Frontend: drag-and-drop seeding UX with persistence — uses `/seeding` endpoint. — Completed 2025-10-24 (TD seeding board + React Query integration)
- [x] Backend: add seeding order endpoint (`PATCH /brackets/:id/seeding`) to store team placements. — Completed 2025-10-21 (service + audit logging).

## Milestone 4 — Scheduling & Queue
- [x] Court assignment UI with drag-and-drop from bracket to court slots. — Completed 2025-10-24 (TD court board + assignment API)
- [x] Conflict detection (player/team overlaps across concurrent matches). — Completed 2025-10-24 (assignment guard + queue warnings)
- [x] Bulk operations: reschedule, retire, swap courts, pause/resume queue. — Completed 2025-10-24 (schedule service bulk endpoints + TD controls)
- [x] Queue prioritization controls and conflict visibility upgrades. — Completed 2025-10-24 (priority ordering + detailed warnings)
- [x] Live queue view (per bracket and global). — Completed 2025-10-25 (`/td/[slug]/queue` + aggregated API)
- [x] Keyboard shortcuts for desk ops (assign, retire, next-up). — Completed 2025-10-26 (Shift+A/R/N shortcuts in TD assignment board)
- [x] Audit log entries for all scheduling ops. — Completed 2025-10-25 (all scheduling mutations emit audit events)

## Milestone 5 — Scoring & Standings
- [x] Score entry UI (tablet-friendly); best-of + win-by-2 logic. — Completed 2025-10-27 (added protected scoring endpoint and TD court modal)
- [x] Auto-advance winners for elimination brackets. — Completed 2025-10-27 (MatchAdvancement links + scoring propagation)
- [x] Standings calculator for RR (wins, losses, PF/PA, **quotient**). — Completed 2025-10-27 (recalc service + scoring integration)
- [x] Persist quotient and tiebreakers; ranking updates. — Completed 2025-10-27 (standings table + API exposure)
- [x] Printable score sheets (with `entryCode`) and per-match print view. — Completed 2025-10-27 (match detail endpoint + print page)
- [x] Tests for scoring flows and tiebreakers. — Completed 2025-10-27 (round-robin quotient coverage)

## Milestone 5a — TD UX Enhancements
- [x] TD login UI (`/login`) that posts to `/api/v1/auth/login` and establishes session. — Completed 2025-10-26 (local storage + AuthContext + redirect)
- [x] Tournament overview homepage (post-login) summarizing divisions, courts, and live queue. — Completed 2025-10-26 (`/td/[slug]` summary dashboard)

## Milestone 6 — Public Views & Kiosk
- [x] Build `/public/[slug]/players` (searchable list). — Completed 2025-10-27 (public API + searchable roster directory)
- [x] Build `/public/[slug]/standings` (with quotient). — Completed 2025-10-27 (public API + standings page)
- [x] Build `/public/[slug]/table` (schedule/queue table). — Completed 2025-10-27 (public queue API + kiosk table)
- [x] Build `/public/[slug]/brackets` (tree + RR grids). — Completed 2025-10-27 (public brackets API + grouped view)
- [x] Add `?kiosk=1` mode (large type, auto-refresh, optional auto-rotation). — Completed 2025-10-27 (public pages detect kiosk query for display tweaks)
- [x] Caching strategy for read-only endpoints; <30s staleness. — Completed 2025-10-27 (cache headers + aligned staleness)

## Milestone 7 — Quality, Docs & Launch
- [x] End-to-end tournament simulation (≥64 players / 6+ courts) without spreadsheets. — Completed 2025-10-28 (simulation script seeded 39 matches, scored all results; metrics archived in `docs/simulations/2025-10-22T15-34-21Z.json`)
- [ ] Performance pass (ensure <2 min from result → next match queued).
- [ ] Error boundary & offline autosave verification.
- [ ] CLI/dev tools for seeding data and resetting tournaments.
- [ ] Documentation: PRD linkage, API README, deployment guide.
- [ ] Release checklist & cut v1.0 tag.
- [x] Auto-generate bracket matches after seeding so scheduling/score simulation can run end-to-end. — Completed 2025-10-28 (seeding transaction now regenerates matches+advancements using bracket config)

## Milestone 8 — UI Polish & Styling
- [x] Establish Tailwind CSS + shadcn/ui design system foundation for Match Point frontend. — Completed 2025-10-28 (Tailwind tooling added, shadcn primitives in place, TD flows restyled)

---

## Backlog / Nice-to-Have
- [ ] Desk Operator role (limited write access).
- [ ] Auto-rotation playlist for kiosk pages.
- [ ] Real-time updates via SSE/WebSocket for TD console & public views.
- [ ] Cloud backup and multi-device TD sync.
- [ ] Import/export presets per organizer.
- [ ] Theming and dark mode for public views.

---

## Bugs / Known Issues (add as discovered)
- [ ] _None logged yet._

---

## Completed
- ✅ Create bracket creation UI and drag-and-drop seeding board — Completed 2025-10-23
