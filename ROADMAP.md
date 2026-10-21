# Matchpoint roadmap

Phase checklist. Specs for the current phase live in `docs/phase-1-plan.md`; working rules in `CLAUDE.md`. Tick items in the same PR that finishes them.

IDs: B = audit bug, S = security, Q = queue fairness, QA = live QA finding (Oct 16, 2026), T = acceptance test.

## Phase 0 — Foundation ✓ (merged in PR #7, main `07c5c36`)

- [x] Node 24 everywhere: `.nvmrc` 24, `engines` `24.x` / npm `>=10`, `postinstall: prisma generate`
- [x] Remove the stale API copy in `frontend/src/lib/auth/routes/`; move bracket config validation to `server/src/config/`
- [x] Fix script paths, single Next config, dependency list (drop `bcrypt`, `cors`; `supertest` to dev)
- [x] Seed script requires `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, no defaults
- [x] CORS allowlist with preview-URL patterns
- [x] Fix three React bugs flagged by lint (lint errors 31 → 0)
- [x] `npm run seed:qa` — QA Test Open 2026
- [x] Jest (`^30.5.2`) with unit and integration tests (38), `tests/setup.js` test-database guard
- [x] GitHub Actions CI on Node 24: server tests on Postgres 16; frontend lint, types, build
- [ ] Hosting settings (outside the repo): `NODE_VERSION=24` on Render, Node.js Version 24.x on Vercel, Supabase session-pooler URL (port 5432)

## Phase 1 — Trustworthy core (next)

Gate: QA Test Open 2026 on 2 courts — no idle court while an eligible match exists, no team plays more than 2 in a row, restart-safe.

- [ ] P1-1 Persist live state; queue pause on `Bracket.queuePaused`, enforced server-side (B1, Q5) — T02
- [ ] P1-2 Round robin by rounds, snake groups, balanced sizes (Q1–Q3, QA-1) — T03–T05
- [ ] P1-3 Spaced `queueOrder` reordering (QA-3) — T07
- [ ] P1-4 Server-side tiered picker, assign-next endpoint (QA-2, Q6) — T06, T08
- [ ] P1-5 Toast and plain-language message for every action (QA-2, QA-6)
- [ ] P1-6 Create division returns counts; no false error (QA-4)
- [ ] P1-7 Generate schedule step (QA-5)
- [ ] P1-8 Score correction, points-to-win, transactional checks (B2, B8, B9) — T09, T10
- [ ] P1-9 Block reseed after play; auto-lock (B6) — T11
- [ ] P1-10 Slug validation and 404 (QA-7)
- [ ] P1-11 No birthdates in public responses; `/t/[slug]`; share card with QR; no TD link on public pages (S4, QA-12)

## Phase 2 — Live court board

Court cards (free / suggested / playing / score pending), queue tabs with reasons, rest setting (soft or strict), auto-assign, score modal that offers the next match, tap-to-assign on phones, live updates over SSE, court management, tournament-wide pause (sets every bracket). Gate: run QA Test Open from one phone with auto-assign on.

## Phase 3 — Brackets that run themselves

Full elimination tree at lock, standard seeding and byes (B3, B5), winner/loser advance and third place, corrections ripple, forfeits (B7), round robin into playoffs, bracket tree view, setup checklist, head-to-head tiebreak (B10); real double elimination or hide it (B4). Gate: 8- and 6-team brackets run to a champion with score entry only.

## Phase 4 — Multi-user and players

Tournament owners and staff, roles (S2, S3), user invites (S7), 401 handling, TV mode, Find me, referee/player score entry with approval, DUPR export, activity log with undo. Gate: two directors and a referee on three devices, no double-booking.

## Phase 5 — Rotating partners and growth

Play format per division (fixed teams or rotating partners), `MatchPlayer`, rotating scheduler (`docs/prototypes/rotating.js`), per-player standings, generation options, free round robin generator page, match timers. Gate: 12-player mixer with 0 repeat partners.

## Phase 6 — Security audit and pentest (before going live)

New admin password and JWT secret (S1), Supabase Data API off or RLS, dedicated database role, backups with a tested restore, rate limits and helmet (S5), token storage review (S6), security audit, dependency audit, pentest on a staging copy. Gate: no high or critical findings open.
