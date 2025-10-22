# TD Console Overview

## Authentication

- `/login` exposes a TD credential form that posts to `POST /api/v1/auth/login`.
- Successful authentication stores the JWT in `localStorage` and hydrates the `AuthContext`.
- All protected TD routes (`/td`) are wrapped with `AuthGuard`, which redirects unauthenticated users back to `/login` with a `next` parameter.
- `Shift +` shortcuts and API hooks automatically reuse the token from context.
- Frontend fetches proxy directly to the Express API; set `NEXT_PUBLIC_API_BASE_URL` (e.g. `http://localhost:3000`) during development to avoid 404s when running the Next.js dev server on a different port.
- When the API is served from a different origin/port, configure CORS via `CORS_ALLOW_ORIGIN` (or rely on the dev default `http://localhost:3100`) so `/api/v1/auth/login` succeeds from the Next.js app.

## Landing Experience (`/td`)

- Quick launcher: enter a tournament slug to jump to the live queue dashboard or go directly to a division page.
- Sign out button clears the stored token and returns to `/login`.
- Global header (present across TD routes) links back to `/td` and surfaces keyboard shortcuts (Shift+A/R/N).

## Tournament Summary (`/td/[slug]`)

- Fetches `GET /api/v1/tournaments/:slug/summary` for aggregated stats:
  - counts for divisions, brackets, courts, active matches, queued matches.
  - Division cards listing brackets, lock status, pending matches, and quick links to `/td/[slug]/divisions/[divisionId]`.
  - Court grid showing active/inactive status.
- Provides shortcuts to the live queue dashboard and manual refresh.

## Court Assignments & Scoring

- Court board retains drag-and-drop queue management, pause/resume, swap, retire, and reschedule controls.
- Each active court card now exposes an **Enter score** action that opens a tablet-friendly modal.
- The modal enforces the bracket configuration (`bestOf`, `winBy2`) and collects per-game scores, then PATCHes `/api/v1/tournaments/:slug/brackets/:bracketId/matches/:matchId/score`.
- Successful submissions release the court, remove the match from the active queue, auto-advance winners into configured downstream matches, and record `MATCH_SCORE_SUBMIT`/`MATCH_ADVANCE_*` audit entries.
- Round-robin brackets display a live standings table (rank, record, PF/PA, quotient) beneath the court board, fed by the standings endpoint.
- Court and queue cards include a **Print sheet** action that opens `/td/[slug]/matches/[matchId]/print`, a printer-friendly score sheet showing entry codes, rosters, and blank game lines.
