## TD Bracket UI Requirements

### Goals
- Allow tournament directors to configure brackets per division using the new backend endpoints.
- Provide clear visibility into bracket type, rules (best-of, win-by-2, finals reset), and bracket state (locked/unlocked).
- Support fast iteration on bracket structures before locking.

### User Flow
1. TD navigates to a division page and sees existing brackets (list + status).
2. TD clicks “Create Bracket” → modal/form prompts for:
   - Bracket type (Single / Double Elimination / Round Robin)
   - Config fields (best-of, win-by-2, rounds/groups, group size, finals reset)
3. Upon submit, frontend POSTs to `/api/v1/tournaments/:slug/divisions/:divisionId/brackets` with bearer token.
4. UI refreshes bracket list and surfaces audit info (created by/time).
5. TD can open a bracket detail drawer to edit config (if unlocked) via PATCH.
6. Once lock is toggled on, config inputs are disabled and a lock badge is shown.
7. Provide drag-and-drop seeding board for unlocked brackets; users drag teams to slots and save via seeding endpoint.

### Component Sketch
- `DivisionBracketsPanel`
  - Fetches `/api/v1/tournaments/:slug/brackets`, filters by division.
  - Renders `BracketCard` per bracket with summary + lock state + “Edit” button.
- `BracketForm`
  - Controlled by state; handles creation & editing.
  - Dynamic fields:
    - Common: bestOf (number), winBy2 (switch)
    - Single/Double: rounds (list of rows: name + match count)
    - Double: finalsReset (switch)
    - Round Robin: groups (number), groupSize (number)
  - Validates before POST/PATCH; displays API errors inline.
- `BracketSeedingBoard`
  - Shows available teams (from registrations) vs seeded slots.
  - Uses DnD Kit drag/drop to assign seeds.
  - On save, PATCH `/api/v1/tournaments/:slug/brackets/:bracketId/seeding` with ordered entries.

### Data Fetch Strategy
- Use React Query/Zustand to cache bracket lists keyed by tournament slug.
- Optimistically update cache after successful POST/PATCH/SEED.
- On lock toggle → PATCH with `{ locked: true }`.
- Additional query for seeding to pre-populate board (future GET endpoint for seeding state).

### Error/State Handling
- Show toast/banner on server validation errors (e.g., missing rounds, duplicate seeds).
- Display audit metadata (actor/time) using `/api/v1/tournaments/:slug/brackets` response + audit fetch (future enhancement).
- Indicate import dependency: bracket config should align with parsed teams/registrations from import.

### Remaining Frontend Tasks
- Add seeding board component consuming `entries` and posting to `/seeding` endpoint.
- Render current seeding order from API once GET support is added.
- Handle backend error states (duplicate seeds, locked bracket) with toasts.

### Backend Enhancements Implemented
- `POST /api/v1/tournaments/:slug/divisions/:divisionId/brackets`
- `PATCH /api/v1/tournaments/:slug/brackets/:bracketId`
- `PATCH /api/v1/tournaments/:slug/brackets/:bracketId/seeding`
- `GET /api/v1/tournaments/:slug/brackets`
- `GET /api/v1/tournaments/:slug/divisions/:divisionId/teams`

Seeding payload shape:
```json
{
  "entries": [
    { "teamId": "team_123", "seed": 1 },
    { "teamId": "team_456", "seed": 2 }
  ]
}
```
- Bracket edit modal allows adjusting config (bestOf, rounds, groups, finals reset) prior to locking.
