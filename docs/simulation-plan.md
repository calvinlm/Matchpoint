# End-to-End Tournament Simulation Plan

## Objective
Validate that Match Point can support a tournament with at least 64 players (32 teams) across 6 courts without relying on external tools, ensuring workflows for import, seeding, scheduling, scoring, and public views all perform within acceptable thresholds.

## Scenario Outline
- **Divisions**: 2 divisions (Men's Doubles INT, Mixed Doubles ADV).
- **Teams**: 16 teams per division (32 total), each with 2 players → 64 players.
- **Courts**: 6 concurrent courts (all active).
- **Brackets**:
  - Division A: Single elimination with consolation rounds.
  - Division B: Round robin groups followed by knockout finals.
- **Workflows**:
  1. Import teams/players via consolidated CSV.
  2. Generate brackets and apply seeding.
  3. Auto-populate queue and assign matches to courts.
  4. Record scores, triggering auto-advance and standings updates.
  5. Verify public endpoints (players, standings, table, brackets) reflect results.

## Success Criteria
- All API requests within workflows complete successfully.
- Standings and brackets reflect expected winners/quotients after fully scoring the bracket sets.
- Overall simulated completion time from first score entry to final standings < 2 minutes.
- No errors in logs; audit trail populated for major operations.

## Implementation Approach
1. **Fixture Data**: Generate CSV with 64 players and seed notes; reuse in test harness.
2. **Automation Script**: Build Node script in `scripts/simulations/simulateTournament.js` orchestrating API calls using existing endpoints.
3. **Metrics**: Measure duration of key phases (import, scheduling, scoring) and log summary JSON.
4. **Output**: Produce report under `docs/simulations/` capturing timings and any anomalies.

## Tooling
- Script: `scripts/simulations/simulateTournament.js`
- Usage: `npm run simulate:tournament`
- Environment: set `SIM_API_BASE_URL` (defaults to `http://localhost:3000/api/v1`), `TD_EMAIL`, and `TD_AUTH_PASSWORD` before running.

Next steps: implement simulation script and integrate into npm test/CI optional target.
