# 🗺️ PLANNING.md — Match Point Project Plan

## 1. Vision

**Goal:**  
Deliver a robust, offline-capable tournament management platform for pickleball events that eliminates spreadsheet dependency and accelerates on-site operations.

**Core Objectives:**  
- Streamline setup, scheduling, queuing, and scoring for tournament directors (TDs).  
- Provide fast, reliable, read-only public dashboards for spectators.  
- Ensure operational resilience (auto-save, audit logs, undo/redo).  
- Offer seamless import/export for teams, players, and matches.

**Target Outcome:**  
A tournament with ≥64 players and 6+ courts can be run entirely within Match Point without external tools.

---

## 2. System Architecture

### 2.1 Overview
Match Point follows a **modular, service-based architecture** emphasizing scalability, reliability, and maintainability.

```
┌────────────────────────┐
│     Public Frontend     │
│  (Next.js / React)      │
│  - Brackets viewer       │
│  - Schedules & standings │
│  - Kiosk/TV mode         │
└──────────┬──────────────┘
           │ REST API
┌──────────┴──────────────┐
│        API Layer         │
│ (Next.js API routes /    │
│  Express / Fastify)      │
│  - Tournament CRUD        │
│  - Import/Export          │
│  - Scoring & standings    │
│  - Public read-only views │
└──────────┬──────────────┘
           │ Prisma ORM
┌──────────┴──────────────┐
│     Database Layer       │
│ (PostgreSQL / SQLite)    │
│  - Tournaments            │
│  - Divisions              │
│  - Brackets / Matches     │
│  - Teams / Players        │
│  - Courts / Queues        │
│  - Standings / Logs       │
└──────────────────────────┘
```

### 2.2 Key Modules
1. **Tournament Core:** CRUD operations, slugs, planned court creation.  
2. **Import Engine:** CSV parser with dedupe logic and entry code generation.  
3. **Bracket Engine:** Configurable rounds, groups, and progression logic.  
4. **Scheduling Engine:** Conflict detection, bulk rescheduling, queue handling.  
5. **Scoring System:** Match finalization and quotient-based standings.  
6. **Public Renderer:** Read-only endpoints and kiosk mode frontends.

### 2.3 Data Flow
- TD creates or imports tournament data.  
- API normalizes and stores data via Prisma models.  
- Match results trigger live updates to standings and queues.  
- Public endpoints render cached or real-time JSON for web clients.  

---

## 3. Technology Stack

### 3.1 Frontend
- **Framework:** Next.js 14 (App Router)  
- **Language:** TypeScript  
- **UI Library:** React 18 + Tailwind CSS  
- **Components:** shadcn/ui, lucide-react  
- **Visualization:** Recharts (for brackets & standings)  
- **State Management:** Zustand or React Query  
- **Printing:** Browser-based printable layouts (PDF-ready)  

### 3.2 Backend
- **Runtime:** Node.js 20+  
- **Framework:** Next.js API routes or Express (depending on hosting)  
- **ORM:** Prisma  
- **Database:** PostgreSQL (prod) / SQLite (dev)  
- **Auth:** NextAuth (password or magic link)  
- **API Type:** REST (slugged routes)  
- **Data Import:** Papaparse for CSV; custom dedupe & mapping logic  

### 3.3 Infrastructure
- **Hosting:** Vercel or Render (for API + static)  
- **Database Hosting:** Supabase / Railway / Neon  
- **Storage (optional):** Supabase buckets for exports  
- **CI/CD:** GitHub Actions for linting, tests, and schema validation  

### 3.4 Developer Tooling
- **Code Editor:** VS Code with Prisma, ESLint, Prettier extensions  
- **Version Control:** Git + GitHub (feature branches per task)  
- **Task Management:** TASKS.md (in-repo), no external tracker  
- **Testing Framework:** Vitest or Jest + Supertest  
- **Linting & Formatting:** ESLint + Prettier  
- **Schema Visualization:** Prisma ERD via mermaid or Prisma Studio  

---

## 4. Required Tools List

| Tool | Purpose |
|------|----------|
| **Node.js 20+** | Runtime for both API and Next.js frontend |
| **npm / pnpm** | Package management |
| **Prisma** | ORM for database access |
| **PostgreSQL** | Production database |
| **SQLite** | Local dev database |
| **Next.js** | Frontend & API integration framework |
| **Tailwind CSS** | Styling system |
| **shadcn/ui** | UI component kit |
| **lucide-react** | Icon library |
| **Recharts** | Visualization for brackets and standings |
| **Papaparse** | CSV import parsing |
| **NextAuth** | Authentication for TD |
| **Supabase / Neon** | Managed Postgres + storage |
| **Git + GitHub** | Version control |
| **ESLint + Prettier** | Code quality and style enforcement |
| **Vitest / Jest** | Unit and integration testing |
| **Mermaid / Prisma Studio** | ERD visualization |
| **Vercel / Render** | Deployment environment |

---

## 5. Development Guidelines

1. Read `PLANNING.md` at the start of each session.  
2. Check `TASKS.md` for current priorities before beginning work.  
3. Mark tasks complete in `TASKS.md` immediately after finishing.  
4. Log new findings, blockers, or improvements as new tasks.  
5. Reference `CODEX.md` for process consistency and coding conventions.  

---

**PLANNING v1.0 — Updated: 2025-10-20**  
**Based on PRD:** `match_point_prd_v1.md`  
**Maintained by:** MPLR Project — Match Point
