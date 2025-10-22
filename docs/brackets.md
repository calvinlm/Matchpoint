## Bracket Engine Overview

### Supported Types
- `SINGLE_ELIMINATION`
- `DOUBLE_ELIMINATION`
- `ROUND_ROBIN`

### Configuration Schema

#### Common Fields
- `bestOf` (int, default 1)
- `winBy2` (bool, default true)

#### Single/Double Elimination
- `rounds`: array of `{ name, matchCount }`
- `finalsReset`: boolean (double elimination only, default false)

#### Round Robin
- `groups`: positive int (default 1)
- `groupSize`: positive int (default 4)

### API Endpoints
- `POST /api/v1/tournaments/:slug/divisions/:divisionId/brackets`
- `PATCH /api/v1/tournaments/:slug/brackets/:bracketId`
- `PATCH /api/v1/tournaments/:slug/brackets/:bracketId/seeding`
- `GET /api/v1/tournaments/:slug/brackets`
- `GET /api/v1/tournaments/:slug/divisions/:divisionId/teams`
- `GET /api/v1/tournaments/:slug/brackets/:bracketId/standings`
- `GET /api/v1/tournaments/:slug/matches/:matchId`
- `POST /api/v1/tournaments/:slug/divisions`
- `GET /api/v1/public/:slug/players`
- `GET /api/v1/public/:slug/table`
- `GET /api/v1/public/:slug/brackets`
- `GET /api/v1/tournaments/:slug/brackets/:bracketId/matches`

All POST/PATCH routes require TD auth and log audit events.

### Match Advancement
- `MatchAdvancement` table links a source match to a downstream slot with `placement` (`WINNER`/`LOSER`) and `slot` (`1` or `2`).
- When a score is submitted via `PATCH .../matches/:matchId/score`, winners (and eligible losers) automatically populate the configured downstream slot.
- Auto-advance enforces slot uniqueness; attempts to overwrite a different team return `409`.
- Audit entries record both score submissions and advancement actions (`MATCH_ADVANCE_WINNER` / `MATCH_ADVANCE_LOSER`).

### Public Standings Endpoint
- `GET /api/v1/public/:slug/standings`
  - Returns tournament divisions with each bracket's standings.
  - Standings include entry code, wins/losses, PF/PA, quotient, and rank.
  - Response contains `updatedAt` timestamp for downstream cache headers.

### Seeding API
- `PATCH /api/v1/tournaments/:slug/brackets/:bracketId/seeding`
  - Body: `{ entries: [{ teamId: string, seed: number }, ...] }`
  - Validations: positive unique seeds, bracket must belong to tournament, bracket unlocked.
  - Truncates existing seeding and writes new rows in `BracketSeeding` table; audit entry recorded.
  - Automatically regenerates bracket matches (and match advancement links for elimination brackets) based on the submitted seeds and bracket config.

Seeding requires teams to be registered in the target division; unregistered team IDs will be rejected.
- `GET /api/v1/tournaments/:slug/divisions/:divisionId/teams` (auth required) — returns registered teams (with players and optional seeding when `bracketId` query is provided).
- `/division teams` route supports frontend seeding board (requires auth token).
