# Scheduling UI Notes

## Court Assignment Board

- Lives on the TD division page under each bracket card.
- Fetches `/api/v1/tournaments/:slug/brackets/:bracketId/schedule` to retrieve:
  - Active courts (with current match assignment, if any).
  - Queue of unassigned matches awaiting courts.
- Uses `@dnd-kit/core` for drag-and-drop:
  - Drag from queue → court assigns the match.
  - Drag from court → queue unassigns the match.
- Assignment requests hit `PATCH /api/v1/tournaments/:slug/brackets/:bracketId/matches/:matchId/assignment`.
  - Passing `courtId` applies the court (timestamp defaults to now).
  - Passing `null` clears the court assignment.
- The board auto-refreshes every 30s to keep the TD view fresh for other operators.
- Matches that share a team/player with an active court highlight with a red border and will be blocked from assignment until the conflict clears (backend returns `409`).
- TDs can now:
  - Pause/resume the ready queue (disables new assignments until resumed).
  - Reschedule a match (update or clear start time).
  - Retire a match (removes it from active queue/court).
  - Swap two active matches between courts.
  - Reorder queued matches (move up/down) to adjust priority.
- `/td/[slug]/queue` shows a tournament-wide live queue view (global list + per-bracket cards) powered by `GET /api/v1/tournaments/:slug/queue`.
- Keyboard shortcuts in the court assignment board: `Shift+A` assigns the top queued match to the first open court, `Shift+R` retires the top queued match, and `Shift+N` advances the queue order.
- Conflict warnings now surface the exact teams and players overlapping with active courts for quicker resolution.
- Queue pause state and priorities are currently maintained in memory for the active server session; persistence will be wired to the database in a follow-up migration.

## Follow-up Next

- Build queue ordering controls (manual drag ordering or priority flags).
- Surface conflict warnings (shared players/teams) ahead of assignment.
- Add quick actions for “Mark in-progress” and “Complete match” once scoring lands.
