# Phase 1 — Trustworthy core

Goal: the schedule is fair, nothing is lost on restart, and nothing fails silently.
Gate: rerun `npm run seed:qa` and play QA Test Open 2026 on 2 courts — no court idle while an eligible match exists, no team plays more than 2 in a row, restarting the API mid-event changes nothing.

IDs: B = audit bug, S = security, Q = queue fairness, QA = live QA finding (Oct 16 test), T = acceptance test.

Do the tasks in order. One branch and PR each.

## P1-1 Persist live state (B1, Q5) — do first

Branch: `fix/p1-1-persist-live-state`.

**Problem** (anchors verified at main `07c5c36`; re-check line numbers before editing):
- `server/src/services/scheduling.js` lines 4–6 hold three module-level `Map`s: `queuePriorityOverrides` (match id → priority), `matchStatusOverrides` (match id → `PENDING` / `ACTIVE` / `COMPLETED` / `RETIRED`), `queuePauseOverrides` (bracket id → boolean).
- Readers at lines 37–70 (`getPriorityValue`, `getStatusValue`, `getQueuePausedValue`) fall back to `match.priority`, `match.status` and `bracket.queuePaused`. None of those columns exist in `server/prisma/schema.prisma`, so after a restart every match reads as priority 0, status `PENDING`, and every queue as unpaused.
- Writers: `scheduling.js` 609/611 (`updateMatchAssignment`), 734 and 841 (bulk reschedule), 961 (`retireMatches`), 1141–1142 (`swapMatchCourts`), 1163 (`setQueuePaused`), 1291 (`reorderQueue`); `server/src/services/scoring.js` imports the helpers at 4–6 and calls them at 312–320 after a score.
- Consequences: a retired match comes back as pending; manual queue order is lost; a paused bracket resumes. Pause is also only enforced in the browser (`frontend/.../CourtAssignmentBoard.tsx:544`); the API will assign a match from a paused bracket.

**Decision: queue pause is per bracket**, stored as `Bracket.queuePaused`. That is what the code already does (the `PATCH /api/v1/tournaments/:slug/brackets/:bracketId/queue` route at `routes/brackets.js:739`, the Map keyed by bracket id, per-bracket "Queue paused" badges in `TournamentQueuePanel.tsx`). A tournament-wide "pause everything" (rain, lunch) is a Phase 2 convenience that sets every bracket in one call; it does not need its own column.

**Migration** (`npx prisma migrate dev --name persist_live_state`):
- `enum MatchStatus { PENDING CALLED ACTIVE COMPLETED RETIRED }`
- `Match`: `status MatchStatus @default(PENDING)`, `queueOrder Int?`, `manuallyOrderedAt DateTime?`, `round Int?`, `groupIndex Int?`, `heldAt DateTime?`, `pinnedCourtId String?`, `calledAt DateTime?`, `startedAt DateTime?` (new: the existing `startTime` doubles as a scheduled time; the backfill copies it into `startedAt` for matches on court), `completedAt DateTime?`; `@@index([bracketId, status, queueOrder])`. (`round`, `groupIndex`, `heldAt`, `pinnedCourtId`, `calledAt` are added now so Phase 1 needs one migration; P1-2 and P1-4 start using them.)
- `Bracket`: `queuePaused Boolean @default(false)`
- Backfill in the same migration SQL:
  - `status = 'COMPLETED'` and `completedAt = updatedAt` where `winnerId IS NOT NULL`
  - `status = 'ACTIVE'` where `winnerId IS NULL AND courtId IS NOT NULL`
  - otherwise `PENDING` (retired matches can't be recovered: that state only ever lived in memory)
  - `queueOrder = 1000 × ROW_NUMBER() OVER (PARTITION BY "bracketId" ORDER BY "createdAt", id)`

**Code changes**
- Delete the three Maps, the three readers and `setMatchStatusOverride` / `clearMatchStatusOverride` / `clearQueuePriorityOverride`; remove their exports and the imports in `scoring.js`.
- Write the columns instead, inside the existing transactions:
  - assign to a court → `ACTIVE`, `startedAt`; unassign → `PENDING`
  - score → `COMPLETED`, `completedAt`; a match that just received a team from advancement stays `PENDING`
  - retire → `RETIRED`; swap → both stay `ACTIVE`
  - reorder → `queueOrder` (P1-3 replaces the priority arithmetic with spaced values; for now map the existing `priorityBase - index` order onto `queueOrder` ascending)
  - pause → `Bracket.queuePaused`
- Queue order everywhere: `queueOrder ASC NULLS LAST, createdAt ASC` instead of priority DESC.
- Enforce pause on the server: `updateMatchAssignment` returns 409 "This bracket's queue is paused" when assigning a queued match from a paused bracket (moving or clearing an active match stays allowed).
- Keep response shapes: `status`, `queuePaused`, and `priority` — the frontend's zod schema requires it (`frontend/src/lib/api/brackets.ts:72`, `priority: z.number().int()`), so return an integer derived from queue position (e.g. queue length − index) until P1-3 switches the client to `queueOrder`.
- Audit entries are unchanged.

**T02 — live state survives a restart** (integration test, `tests/integration/liveState.test.js`; write it first and watch it fail on current code):
1. Seed a 4-team round robin with `tests/helpers/api.js`.
2. Retire one match; move the last queued match to the top; pause the bracket.
3. Simulate a restart: `jest.resetModules()`, then re-require `app` (module-level Maps are recreated empty).
4. Expect via `GET …/brackets/:bracketId/schedule`: the retired match has `status: 'RETIRED'` and is not in the queue; the moved match is first in the queue; `queuePaused: true`.
5. Expect assigning a queued match from the paused bracket to return 409; resuming makes it succeed.

**Done when:** T02 passes; the full suite passes; `grep -n "Overrides\|Override(" server/src` finds nothing; `npm run seed:qa`, then retire / reorder / pause in the TD console, restart the API, and the console shows the same state.

## P1-2 Round robin by rounds (Q1–Q3, QA-1)

Replace the nested loop in `services/matchGeneration.js` `generateRoundRobin`.

- Circle (Berger) method per group: every team plays once per round; odd count adds a bye, one per team. Store `round` (0-based) and `groupIndex`. Alternate which team is `team1` each round.
- Snake-seed groups: 8 teams / 2 groups → A {1,4,5,8}, B {2,3,6,7}.
- Balanced sizes: 10 teams in 3 groups → 4, 3, 3 (today 4, 4, 2). `groupSize` becomes a maximum.
- Initial `queueOrder`: by round, then group, then position, spaced by 1000.
- Reference: `docs/prototypes/rr_sim.js` (circle implementation + fairness metrics).
- Tests: T03 (6 teams: each round has each team at most once; across the schedule played-count spread ≤ 1 at round boundaries), T04 (5 teams: one bye per round, each team exactly one), T05 (groups above). Keep the existing pair-once integration tests.

## P1-3 Reordering that works (QA-3)

- Moving a match sets `queueOrder` to the midpoint of its new neighbours; if the gap is < 2, renumber that bracket's queue by 1000s in the same transaction.
- `reorderQueue` takes the full new order for a bracket or a single move `{ matchId, beforeMatchId }`.
- Tests: T07 (move 5th to top → holds after refresh and restart).

## P1-4 Server-side picker (QA-2, Q6)

New `services/picker.js`, used by a new `POST /:slug/courts/:courtId/assign-next` and by Shift+A / Shift+N.

- Eligible: status `PENDING`/`CALLED`, both teams set, no team on an active match, no team on hold, bracket not paused.
- Rank in tiers, first difference wins (not a weighted sum):
  1. pinned by the TD (`pinnedCourtId` = this court, or pinned "next")
  2. both teams rested ≥ `minRestMinutes` (default 10; a team that hasn't played counts as rested since event start)
  3. placed manually by the TD (`manuallyOrderedAt` is set; P1-3 sets it on every move), by `queueOrder`
  4. lowest `round`
  5. longest rest (capped at 3 × minRest)
  6. `queueOrder`
- Return `{ match, reason }`, e.g. `"Round 2 · both teams rested 14 min"`, `"Moved up by you"`, `"Short rest: Team C finished 4 min ago"`. If nothing is eligible, return the reason for the best blocked match (`"Team A is on Court 1"`).
- Pick and assign inside one transaction; re-check the court and teams there so two directors can't double-book.
- Evidence for this design: `docs/prototypes/picker_sim.js` (simulation: tiers make manual moves start at minute 0 instead of 76; other tweaks changed nothing).
- Tests: T06 (top match blocked → next eligible assigned; none eligible → 409 with reason), T08 (two concurrent assigns sharing a team → one succeeds, one 409).

## P1-5 Feedback on every action (QA-2, QA-6)

- Frontend toast for every mutation success and failure, with the server's message ("Assigned A–B to Court 1", "Can't assign: Team A is on Court 1").
- Replace developer-facing server messages in scoring and scheduling with plain language.

## P1-6 Create division returns counts (QA-4)

The client shows a false error after a successful create because the response lacks fields it checks. Return `bracketCount` and `teamCount` (0 on create) and align the client check. Add an integration test.

## P1-7 Generate schedule step (QA-5)

Matches are only created when seeding is saved; locking a bracket says nothing. Add a clear "Generate schedule" action (uses current seeding or seeds by registration order) and an explanation when a bracket has no matches.

## P1-8 Score correction and validation (B2, B8, B9)

- `PATCH …/matches/:matchId/score` with `{ games, correction: true }` (or a separate endpoint) on a completed match: allowed only if no match fed by it has started; reverses advancement, re-applies, recalculates standings, audit entry with old and new score.
- Points-to-win: bracket config `pointsToWin` (11 / 15 / 21, default 11) and optional `cap`; a game must reach it (win by 2 when on, unless cap reached).
- Move the "already completed" check inside the transaction (`updateMany where winnerId IS NULL`, expect count 1).
- Flip the two pinned tests. Tests: T09, T10.

## P1-9 Protect played matches (B6)

Block reseeding/regeneration once any match in the bracket is scored or on court (409 with explanation); auto-lock the bracket on its first score. Test: T11.

## P1-10 Slugs (QA-7)

Validate slugs (lowercase letters, digits, hyphens), auto-fill from the tournament name in the form, 404 page for unknown slugs in `/td` and `/public`.

## P1-11 Player view basics (S4, QA-12)

- Public endpoints never return `dateOfBirth`.
- `/t/[slug]` short link → public queue page; keep `/public/...`.
- "Share with players" card on the TD overview: copy link, QR code, printable poster.
- Remove the "TD Console" link from public pages.

## Acceptance tests for this phase

| ID | Scenario | Expected |
| --- | --- | --- |
| T02 | Retire a match, move a match to the top, pause the bracket; simulate a restart (`jest.resetModules()`, re-require `app`) | Retired match stays retired and out of the queue; moved match stays first; bracket stays paused and the API refuses to assign from it (409) until resumed |
| T03 | RR 6 teams, 2 courts | One match per team per round; ≤ 2 in a row; spread ≤ 1 at round boundaries |
| T04 | RR 5 teams | One bye per round; each team sits once |
| T05 | 8 teams/2 groups; 10 teams/3 groups | {1,4,5,8} {2,3,6,7}; sizes 4,3,3 |
| T06 | Court frees, top match blocked | Next eligible assigned, or 409 naming the reason |
| T07 | Move 5th match to top; refresh; restart | Order holds |
| T08 | Two devices assign matches sharing a team | One succeeds; other gets a clear conflict |
| T09 | Correct a score before the next match starts | Winner, standings, advancement update; audit has old and new |
| T10 | 11–10 and 3–1 in a game to 11 win-by-2 | Plain-language error each; nothing saved |
| T11 | Reseed after a score | Blocked with explanation |
