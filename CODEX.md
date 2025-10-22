# 🧭 CODEX.md — Match Point Project Coding Guidelines

## Purpose
This document defines the **rules, workflow, and operational conventions** for all code-related sessions in the **Match Point** project.  
It ensures continuity, alignment with the **PRD**, and proper synchronization of planning and task tracking across contributors and coding sessions.

---

## 🔁 Workflow Mandates

### 1. Session Initialization
At the **start of every new conversation or coding session**, the assistant **must read and interpret** the following documents in this order:

1. **PLANNING.md** — for current development direction, priorities, and context.  
2. **TASKS.md** — for the current task list, completion statuses, and open issues.  
3. **CODEX.md** — this file, to reaffirm workflow discipline and rules.  

> ⚠️ Always confirm alignment with PLANNING.md before writing or modifying any code.

---

### 2. Task Management Discipline

- **Before beginning any implementation:** Check **TASKS.md** for assigned or pending tasks related to the area of focus.  
- **Immediately after completing a task:** Update **TASKS.md** to mark it as *completed*, including timestamp and brief completion note.  
- **When discovering new actionable work:** Append it as a new task entry in **TASKS.md** under the appropriate section (e.g., “Backend,” “Frontend,” “Docs”).  
- **Never delete tasks.** Use strikethrough or “✅ Completed” notation for traceability.  

> Example entry in TASKS.md:
> ```md
> - [x] Implement /api/v1/public/:slug/brackets endpoint — Completed 2025-10-20
> - [ ] Add kiosk mode rotation for /public pages
> ```

---

## 🧩 Development Principles

### 1. Source of Truth
The **PRD (`match_point_prd_v1.md`)** is the definitive reference for:
- System architecture and entities
- User roles and permissions
- API routes and data models
- UX/UI specifications
- Non-functional requirements

If discrepancies arise between PLANNING.md and the PRD, **defer to the PRD** and document the difference as a **task in TASKS.md**.

### 2. Branching Logic (for version-controlled workflows)
- Create branches per feature or fix (e.g., `feature/bracket-config`, `fix/quotient-calc`).
- Prefix commits with context tags: `[backend]`, `[frontend]`, `[api]`, `[docs]`, `[infra]`.
- Link commits to tasks using `TASKS.md` identifiers.

### 3. Implementation Order (v1 Roadmap)
Follow the PRD’s **Implementation Roadmap (v1)** strictly:
1. Schema & API Foundation  
2. Core TD UI  
3. Scheduling & Queue Management  
4. Scoring & Standings  
5. Public Views  
6. QA & Launch  

### 4. Data & Schema Updates
- Always align database schema with the **Prisma model** defined in the PRD.  
- Validate against the **Data Model Summary** and **API Endpoints** sections.  
- Any schema change must be reflected in both **PLANNING.md** and **TASKS.md**.

### 5. Testing & Validation
- Unit test all core logic (bracket generation, standings, imports).  
- Validate REST endpoints with sample CSV imports and simulated tournaments.  
- Confirm that the system meets all **Success Criteria** from the PRD.

---

## 🧠 Coding Conduct

- Maintain **readability** and **predictable patterns** in all code.  
- Prefer **modularity** over monolithic scripts.  
- Document all non-trivial functions with inline comments referencing PRD sections.  
- Keep **console logging** minimal; prefer structured debugging messages.  
- Ensure code supports **offline safety** and **auto-save** mechanisms per PRD specs.

---

## 🚀 Automation Integration Rules

1. Always check **TASKS.md** before triggering any automation, build, or test pipeline.  
2. Document automated jobs (e.g., migrations, exports, deploy scripts) as entries in TASKS.md.  
3. Update **PLANNING.md** when major automation or refactoring milestones are completed.

---

## 🧾 Document Synchronization Rules

Whenever PRD or schema changes occur:
- Update **PLANNING.md** with adjusted priorities.
- Create corresponding update entries in **TASKS.md**.
- Include a summary note at the top of **CODEX.md** if changes affect workflow discipline.

---

## 🧭 Enforcement Summary

To maintain project integrity, **every code session must comply** with these checkpoints:

1. ✅ Read `PLANNING.md` before writing or editing code.  
2. ✅ Check `TASKS.md` before starting work.  
3. ✅ Update `TASKS.md` after completing or discovering tasks.  
4. ✅ Reference `match_point_prd_v1.md` for architectural truth.  
5. ✅ Commit and document work transparently.

> Failure to follow these guidelines risks project desynchronization and workflow drift.

---

---

## Session Log

### 2025-10-20 → 2025-10-21
- bootstrapped Prisma schema (tournaments, divisions, brackets, matches, standings, registrations, teams, players, courts) plus `AgeGroup`/`Level` enums.
- added seed script, generated migrations, and built Express API with `/api/v1/tournaments` (POST/GET/PATCH) protected by JWT login.
- introduced audit logging (`AuditLog` model + service), recorded entries for tournament create/update.
- created Jest + Supertest integration suite covering auth, CRUD, and audit behaviour.
- wired GitHub Actions CI to run Prisma generate/migrate/validate and the test suite against Postgres.

### 2025-10-21 (later)
- delivered consolidated CSV importer with Papaparse dedupe logic for divisions, players, teams, registrations.
- implemented entry code generator (`{age}{division}{level}_{seq}`) and transactional `/api/v1/tournaments/:slug/import` endpoint with audit logging.
- expanded integration tests to cover import success/error paths and entry-code sequencing; added unit tests for parser/generator helpers.
- documented import workflow (`docs/import.md`) and updated testing plan for authenticated import scenarios.

### 2025-10-22
- introduced bracket configuration validation module and new REST routes for creating/updating brackets (with audit logging).
- implemented bracket retrieval endpoint plus integration tests covering locking, config updates, and error states.
- documented bracket engine requirements (`docs/brackets.md`) and outlined frontend follow-up work.

### 2025-10-22 (later)
- added Prisma seeding relation and `PATCH /.../brackets/:id/seeding` endpoint with validation and audit logging.
- expanded integration tests to cover seeding success/validation; ensured seeding respects registered teams per division.
- documented seeding API contract and frontend needs (`docs/brackets.md`, `docs/frontend/brackets-ui.md`).

### 2025-10-23
- scaffolded typed frontend API clients and React Query hooks for bracket CRUD/seeding workflows.
- exposed division team roster endpoint and wired initial Next.js TD division page with bracket list panel.
- documented frontend wiring and updated path aliases via `tsconfig.json`.

### 2025-10-23 (later)
- implemented TD bracket creation form and lock toggle in division panel using React Query mutations.
- updated tasks/docs to reflect frontend progress; QueryClient provider wraps `(td)` segment.
- added drag-and-drop seeding board integrating division teams endpoint and seeding API.

### 2025-10-24
- polished bracket UI with success/error toasts on creation, locking, and seeding actions.
- ensured division panel surfaces edit modal, board feedback, and refreshed docs/tasks accordingly.

### 2025-10-25
- extended scheduling service and API: added queue pause toggles, bulk reschedule/retire/swap endpoints, conflict detail enrichment (teams/players), and in-memory priority handling to avoid DB migration.
- expanded TD division board with pause/resume, reschedule, retire, swap, and queue reorder controls plus enhanced conflict messaging.
- updated frontend API typings/hooks, docs, and scheduling integration tests to cover the new scheduling workflows.
- delivered tournament-wide live queue view (`/td/[slug]/queue`) backed by `GET /api/v1/tournaments/:slug/queue` for global monitoring.

### 2025-10-26
- finalized the live queue rollout: added client-facing hooks/components (global & per-bracket views), verified scheduling integration suite (38 tests) passes against Postgres, and synced docs/tasks.
- implemented TD keyboard shortcuts (Shift+A/R/N) for assign/retire/advance operations in the court assignment board.
- delivered TD login flow (AuthContext, `/login` page, auth guard) with local storage JWT handling and `/td` home helper.
- built tournament summary page (`/td/[slug]`) aggregating division stats, court status, and queue metrics.
- updated docs (`docs/frontend/td-console.md`) capturing TD console flows; closed Milestone 5a tasks.
### 2025-10-27
- implemented protected match scoring endpoint with best-of / win-by-2 enforcement, auto-advancement propagation, audit logging, and queue cleanup.
- added React Query scoring hook plus TD court board modal for per-game entry; updated schedule summaries to surface score payloads.
- introduced `MatchAdvancement` schema links, standings recalculation service with quotient ranking, TD standings table + API, refreshed docs, and marked the Milestone 5 scoring tasks complete in `TASKS.md`.
- delivered match print endpoint + `/td/[slug]/matches/[matchId]/print` sheet, wired queue/court actions, and documented printable workflow.
- shipped unauthenticated `/api/v1/public/:slug/standings` plus `/public/[slug]/standings` page, exposing division/bracket standings for kiosks.
- shipped `/api/v1/public/:slug/players` and `/public/[slug]/players` directory with search across entry codes, teams, and rosters.
- shipped `/api/v1/public/:slug/table` and `/public/[slug]/table` to surface live courts and queued matches for kiosk displays.
- added `?kiosk=1` support across public pages (larger typography, faster refresh, kiosk-friendly layouts).
- aligned public endpoints with cache headers (7–30s) to support CDN/browser caching.
- delivered `/public/[slug]/brackets` with grouped elimination rounds and round-robin grids backed by new public brackets endpoint.
- expanded scoring integration tests to cover round-robin quotient tiebreakers and additional player fixtures.
- expanded simulation script to include required CSV columns, ensuring team import succeeds during end-to-end runs.

### 2025-10-28
- Added Tailwind CSS + shadcn/ui foundation (tooling, tokens, component registry) and introduced shared primitives (`Button`, `Card`, `Alert`, `Skeleton`, `Switch`, etc.).
- Restyled TD login, home, tournament overview, division management, and court assignment flows to use shared components, including enhanced modals and error/loading states.
- Updated TD layout with a persistent header highlighting keyboard shortcuts and quick navigation back to `/td`.
- Polished tournament queue dashboard cards/tables and surfaced overview shortcuts.
- Restyled public players, queue, standings, and brackets pages (including kiosk modes) with shadcn cards, badges, and alerts for consistent UX.
- Documented the UI system updates in `docs/frontend/ui-system.md` and noted header changes in `docs/frontend/td-console.md`.

**CODEX v1.0 — Updated: 2025-10-21**  
**Based on PRD:** `match_point_prd_v1.md`  
**Maintained by:** MPLR Project — Match Point
