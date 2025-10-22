# 🏓 Match Point — Product Requirements Document (PRD, v1)

## 1. Product Overview

**Product Name:** Matchpoint  
**Purpose:** A match control and operations platform for pickleball tournaments that enables tournament directors to create brackets, schedule and queue matches, track scores, and display public results — all without relying on spreadsheets or manual coordination.  
**Primary User:** Tournament Director (TD)  
**Secondary User:** Public/Spectators (read-only views)

The MVP (v1) focuses on **core tournament operations**, emphasizing speed, reliability, and ease of use on-site for small teams under time pressure.

---

## 2. Product Vision

Match Point is designed to be a **resilient, easy-to-use tournament operations hub** that replaces manual spreadsheets with real-time, structured management.  

### Vision Statement
> “Enable tournament staff to run a 64+ player pickleball event — including scheduling, scoring, and bracket management — entirely within Match Point, without data loss or manual fallbacks.”

### Key Goals
- Simplify operations so volunteer or part-time staff can manage play efficiently.
- Provide **complete visibility** to players and spectators via live, read-only dashboards.
- Support **printable and exportable assets** (score sheets, schedules, brackets).
- Maintain **robust offline tolerance** and **auto-save** for all operational actions.

---

## 3. Target Outcomes & Success Metrics

| Area | Success Metric | Target |
|------|----------------|--------|
| Tournament Flow | End-to-end event (≥64 players, ≥6 courts) run without spreadsheets | ✅ 100% feasible |
| Match Creation Speed | Time to create and queue next match | < 2 minutes |
| Data Integrity | Zero critical data loss during refresh or disconnect | 100% autosave |
| UX Efficiency | TD able to complete all workflows with keyboard or drag-and-drop | ≥90% ops covered |
| Public Engagement | Live read-only pages accessible and self-updating | <30s refresh latency |

---

## 4. In-Scope Features (v1)

### 4.1 Core Entities
- **Tournaments**
- **Divisions**
- **Brackets**
- **Matches**
- **Courts**
- **Players**
- **Teams**
- **Schedules / Queues**
- **Standings**

### 4.2 Bracket Management
- Create and modify brackets (single, double elimination; optional round robin).  
- Drag-and-drop placement and reseeding (no seeding algorithms).  
- Multi-bracket per division support (e.g., A/B/C groups).  
- Configurable parameters (`bestOf`, `winBy2`, `rounds`, `groups`, etc.).  

### 4.3 Scheduling & Court Management
- Assign matches to courts and timeslots.  
- Bulk operations (reschedule, retire, swap courts).  
- Conflict detection (shared players or overlapping divisions).  
- Live court queue management with next-up visualization.  

### 4.4 Score Tracking & Progression
- UI for match score entry (desktop/tablet friendly).  
- Automatic progression of winners in elimination brackets.  
- Auto-calculation of standings in round robin, with quotient-based tiebreakers.  
- Printable **score sheets** with team/entry codes.  

### 4.5 Import / Export / Print
- Consolidated **CSV import** for players, teams, and registrations.  
- CSV/JSON export for all entities.  
- Printable bracket trees, schedules, and standings.  

### 4.6 Public Views (Read-Only)
- Accessible via `/public/[slug]/*`  
  - `/players` — player/team listings  
  - `/standings` — standings per bracket/division  
  - `/table` — tabular view of schedules/queues  
  - `/brackets` — tree visualization  
- Kiosk/TV mode: auto-refresh, large typography, optional rotation.  

---

## 5. Out of Scope (v1)

- Player rankings, ELO, or seeding algorithms.  
- Payment processing or ticketing.  
- Pool-play and seeding pools.  
- Player mobile self-service (beyond public views).  
- Complex authentication or multi-role RBAC.  

---

## 6. Users & Roles

| Role | Description | Access Level |
|------|--------------|--------------|
| **Tournament Director (TD)** | Operates full system: configures tournaments, brackets, schedules, and scores. | Full CRUD; authenticated. |
| **Spectator/Public** | View-only access to live data and results. | No authentication; read-only. |

### 6.1 TD Capabilities
- Manage tournaments, brackets, and courts.  
- Add/import players & teams; manually place teams into brackets.  
- Drag-and-drop operations within brackets.  
- Adjust schedules and live queues.  
- Record/verify scores.  
- Export or print layouts.  
- View change logs and undo/redo actions.  

### 6.2 Public Capabilities
- View brackets, schedules, courts, and live scores.  
- Filter by division/court/time.  
- Auto-refresh dashboards for displays or mobile devices.  

---

## 7. Functional Requirements

### 7.1 Authentication
- Single **TD admin account** with password or magic link.  
- Optional `kioskToken` for authorized TV/kiosk URLs.  

### 7.2 Tournament Setup
- Create tournament with `{ name, slug, startDate, plannedCourtCount }`.  
- On create: auto-generate `Court` rows (1..N).  

### 7.3 Consolidated Import (CSV)
**Schema Columns:**
```
divisionName, divisionFormat, divisionLevel, divisionAgeGroup,
teamName,
player1First, player1Last, player1DOB,
player2First, player2Last, player2DOB,
seedNote
```

**Deduplication Rules:**
- Players by (firstName, lastName, DOB).  
- Teams by unordered player pair.  
- Registrations by team+division combination.  

**On Create:** Generate `entryCode` using pattern `{age}{division}{level}_{seq}`  
Example: `18MDInt_001`

### 7.4 Match Operations
- Match CRUD with validation on teams, courts, and rounds.  
- Auto-update standings and quotient after each finalized match.  
- Undo/redo stack with audit logs for every change.  

### 7.5 Public API Endpoints (Read-Only)
| Endpoint | Description |
|-----------|--------------|
| `GET /api/v1/public/:slug/overview` | Tournament summary |
| `GET /api/v1/public/:slug/brackets` | Bracket tree JSON |
| `GET /api/v1/public/:slug/standings` | Division standings |
| `GET /api/v1/public/:slug/table` | Schedule or queue |
| `GET /api/v1/public/:slug/players` | Player/team list |

### 7.6 Admin API Endpoints (TD)
| Endpoint | Description |
|-----------|--------------|
| `POST /api/v1/tournaments` | Create tournament |
| `PATCH /api/v1/tournaments/:slug` | Update tournament info |
| `POST /api/v1/tournaments/:slug/import` | Consolidated import |
| `POST /api/v1/brackets` | Create brackets |
| `PATCH /api/v1/matches/:id` | Update match results |
| `GET /api/v1/audit` | Retrieve operation logs |

---

## 8. Data Model Summary

### Core Tables
- **Tournament:** `id, slug, name, plannedCourtCount, startDate, endDate, location`  
- **Division:** `id, name, level, ageGroup, format, tournamentId`  
- **Bracket:** `id, divisionId, type, config (JSON), locked`  
- **Match:** `id, bracketId, team1Id, team2Id, score, winnerId, courtId, startTime`  
- **Standing:** `id, bracketId, teamId, wins, losses, pointsFor, pointsAgainst, quotient, rank`  
- **Registration:** `id, divisionId, teamId, entryCode, seedNote`  
- **Team:** `id, name`  
- **TeamPlayer:** `teamId, playerId`  
- **Player:** `id, firstName, lastName, gender, DOB`  
- **Court:** `id, label, active`  

### Key Data Enhancements (from feedback)
- **AgeGroup Enum:** `JUNIOR`, `A18`, `A35`, `A50`  
- **EntryCode Uniqueness:** enforced per division  
- **Slug-based Routing:** for clean URLs and imports  
- **Quotient Metric:** stored float for RR tiebreakers  

---

## 9. UX / UI Requirements

### 9.1 Operator Interface (TD)
- Optimized for **desktop/tablet** (landscape orientation).  
- Support **keyboard shortcuts** for desk operations.  
- **Drag-and-drop** interactions for placement, reseeding, and scheduling.  
- **Offline tolerance** with local autosave and sync recovery.  
- **Bulk actions:** retire matches, pause queues, swap courts.  

### 9.2 Public Display Interface
- Auto-refresh (30s default).  
- Responsive design for TVs and mobile.  
- Kiosk mode (`?kiosk=1`) for full-screen cycling of key pages.  

### 9.3 Print Layouts
- Printable assets:  
  - Score sheets  
  - Brackets (tree and RR grids)  
  - Schedules and court assignments  
- Include **entryCode** column for reference.

---

## 10. Non-Functional Requirements

| Category | Requirement |
|-----------|-------------|
| **Performance** | Match updates reflected in public view within 30s |
| **Reliability** | Offline safe; autosave critical actions |
| **Scalability** | Handle 64+ players, 32 teams, 6+ courts |
| **Security** | Simple password/magic link auth for TD |
| **Maintainability** | Modular API, schema-first with Prisma |
| **Auditability** | Every operation logged (who, when, what) |

---

## 11. Open Questions (v1 → v2 considerations)

1. Should we add a **Desk Operator** role distinct from TD for delegated scoring?  
2. What bracket types should ship with v1 — just Single/Double Elim, or include Round Robin?  
3. Should kiosks auto-rotate between multiple pages (e.g., queue, courts, standings)?  
4. Preferred CSV/JSON export field names and formats?  
5. Need for remote sync or cloud backup (multi-device TD access)?  

---

## 12. Implementation Roadmap (v1)

| Phase | Focus | Deliverables |
|-------|--------|---------------|
| **Phase 1** | Schema & API Foundation | Prisma migration, REST endpoints, slug logic |
| **Phase 2** | Core TD UI | Tournament setup, import, bracket creation |
| **Phase 3** | Scheduling & Queue | Court assignments, queue board, bulk ops |
| **Phase 4** | Scoring & Standings | Match entry, quotient logic, printable assets |
| **Phase 5** | Public Views | `/public/[slug]` pages, kiosk mode |
| **Phase 6** | QA & Launch | End-to-end run simulation, performance test |
