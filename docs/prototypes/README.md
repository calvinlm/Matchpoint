# Prototypes

Standalone Node scripts used to measure scheduling designs before building them. Run with `node <file>`; no dependencies.

| File | What it shows | Used for |
| --- | --- | --- |
| `rr_sim.js` | Current nested-loop round robin vs the circle method: back-to-back matches, played-count spread, time to finish | P1-2 |
| `picker_sim.js` | Minute-by-minute court simulation comparing the QA plan's weighted `pickNext` with a tiered picker (late team, two divisions, manual moves, strict rest) | P1-4 |
| `rotating.js` | Rotating-partner scheduler: no repeat partners, sit-outs within one of each other | Phase 5 |

Results recorded Oct 15–16, 2026: manual moves start at minute 0 with tiers vs minute 76 today; with 8 teams on 3 courts, 20 of 28 matches start before teams have rested 10 min, and strict rest adds about an hour (159 → 223 min).
