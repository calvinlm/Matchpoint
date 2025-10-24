## Consolidated CSV Import — Match Point

The `/api/v1/tournaments/:slug/import` endpoint ingests a single CSV that contains divisions, teams, and players. The importer deduplicates records, generates registration entry codes, and creates the necessary Prisma entities inside a transaction.

### Required Columns

| Column | Description |
|--------|-------------|
| `divisionName` | Display name (e.g. `Men's Doubles`) |
| `divisionFormat` | Format label (`DOUBLE`, `RR`, etc.) |
| `divisionLevel` | Competitive level (`NOV`, `INT`, `ADV`, `OPN`) |
| `divisionAgeGroup` | Age band (`A18`, `A35`, `JUNIOR`, …) |
| `teamName` | Optional team label (auto-built from player last names if blank) |
| `player1First`, `player1Last`, `player1DOB` | Primary player (DOB ISO-8601) |
| `player2First`, `player2Last`, `player2DOB` | Optional partner |
| `seedNote` | Optional note carried onto the registration |

Blank rows are ignored; rows without any player names are rejected with a row-level error. When the `teamName` column is left blank, the importer combines the players' last names (e.g., `Anderson / Baker`) to form the team name automatically.

### Deduplication Rules

- **Players** dedupe by `(firstName, lastName, DOB)` within the import batch. Invalid DOB values collapse to `null`, producing distinct player records if a clean DOB also exists.
- **Teams** dedupe by unordered player pairs. Singles (one player) still create unique teams.
- **Divisions** dedupe by `(name, level, ageGroup, format)` and are scoped to the tournament. Existing divisions are reused; missing ones are created.
- **Registrations** dedupe by `(team, division)` and include the `seedNote`.

### Entry Code Generation

Each registration receives an `entryCode` of the form `{age}{division}{level}_{seq}`:
- `age`: `A18` → `18`, `A35` → `35`, `JUNIOR` → `JR`, other values preserved.
- `division`: initial letters of each word (`Men's Doubles` → `MD`, `Women's Doubles` → `WD`).
- `level`: title-cased (`INT` → `Int`, `ADV` → `Adv`).
- `seq`: three-digit counter per division, continuing from existing registrations (e.g. `_001`, `_002`).

Example progression for `Men's Doubles` (`A18`, `INT`):
```
18MDInt_001
18MDInt_002
```

### API Usage

```
POST /api/v1/tournaments/:slug/import
Authorization: Bearer <token>
Content-Type: application/json

{
  "csv": "divisionName,...\nMen's Doubles,..."
}
```

Responses:
- `201 Created` — JSON summary with counts (`divisionsCreated`, `playersCreated`, `teamsCreated`, `registrationsCreated`, `entryCodes` array).
- `400 Bad Request` — Missing/invalid CSV payload or parsing failure (missing headers, etc.).
- `401 Unauthorized` — Bearer token required.
- `404 Not Found` — Tournament slug not recognized.
- `422 Unprocessable Entity` — Row-level validation errors (e.g., missing players); array returned detailing row numbers/messages.

### Sample CSV

```
divisionName,divisionFormat,divisionLevel,divisionAgeGroup,teamName,player1First,player1Last,player1DOB,player2First,player2Last,player2DOB,seedNote
Men's Doubles,DOUBLE,INT,A18,Smash Bros,Mario,Bros,1985-01-01,Luigi,Bros,1987-02-02,Top seed
Mixed Doubles,DOUBLE,ADV,A18,Power Duo,Peach,Toadstool,1990-03-03,Mario,Bros,1985-01-01,
Women's Doubles,DOUBLE,ADV,A35,Queens,Samus,Aran,1986-01-01,Zero,Suit,1986-01-01,New pairing
Singles,RR,INT,A18,Rising Star,Link,Hyrule,1991-05-05,,,,
```

Use the integration test (`tests/tournaments.integration.test.js`) as a working reference for CSV structure and expected outcomes.

### Exporting Existing Data

Download the same consolidated CSV via:

```
GET /api/v1/tournaments/:slug/export
Authorization: Bearer <token>
```

The response is `text/csv` with the identical header ordering documented above. Each row represents a registration (team + division pairing), so the file can be re-imported without altering column names. The export endpoint records an audit log entry with the number of rows emitted.
