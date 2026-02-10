#!/usr/bin/env node

require('dotenv/config');
const { randomUUID } = require('crypto');

const MIN_PLAYER_THRESHOLD = 64;
const MIN_COURT_THRESHOLD = 6;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateTeams(count, prefix) {
  const teams = [];

  for (let index = 0; index < count; index += 1) {
    const suffix = String(index + 1).padStart(3, '0');
    teams.push({
      teamName: `${prefix} Team ${suffix}`,
      players: [
        { firstName: `${prefix} Player ${suffix}A`, lastName: randomUUID().slice(0, 5) },
        { firstName: `${prefix} Player ${suffix}B`, lastName: randomUUID().slice(0, 5) },
      ],
    });
  }

  return teams;
}

class Stopwatch {
  constructor(label, metrics) {
    this.label = label;
    this.metrics = metrics;
    this.startAt = Date.now();
  }

  end() {
    this.metrics[this.label] = Date.now() - this.startAt;
  }
}

async function runWithRetry(url, init, options = {}) {
  const { retries = 3, delayMs = 200 } = options;
  let attempt = 0;

  while (attempt < retries) {
    const response = await fetch(url, init);
    if (response.ok) {
      return response;
    }

    attempt += 1;
    if (attempt >= retries) {
      return response;
    }

    await delay(delayMs);
  }

  throw new Error('unreachable');
}

function safeMetricKey(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function main() {
  const config = {
    slug: `sim-${Date.now()}`,
    courtCount: 6,
    divisions: [
      {
        name: "Men's Doubles INT",
        level: 'INT',
        ageGroup: 'A18',
        format: 'DOUBLE',
        type: 'SINGLE_ELIMINATION',
        teamCount: 16,
      },
      {
        name: 'Mixed Doubles ADV',
        level: 'ADV',
        ageGroup: 'A18',
        format: 'MIXED',
        type: 'ROUND_ROBIN',
        teamCount: 16,
      },
    ],
  };

  const metrics = {};
  const time = (label) => new Stopwatch(label, metrics);
  const startTime = Date.now();
  const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

  const totalTeams = config.divisions.reduce((sum, division) => sum + division.teamCount, 0);
  const totalPlayers = totalTeams * 2;

  if (totalPlayers < MIN_PLAYER_THRESHOLD) {
    throw new Error(
      `Simulation config must include at least ${MIN_PLAYER_THRESHOLD} players (currently ${totalPlayers}).`
    );
  }

  if (config.courtCount < MIN_COURT_THRESHOLD) {
    throw new Error(
      `Simulation config must include at least ${MIN_COURT_THRESHOLD} courts (currently ${config.courtCount}).`
    );
  }

  metrics.playerCount = totalPlayers;
  metrics.teamCount = totalTeams;
  metrics.courtCount = config.courtCount;
  metrics.divisions = config.divisions.length;

  const baseUrl = process.env.SIM_API_BASE_URL || 'http://localhost:3000/api/v1';
  const tdEmail = process.env.TD_EMAIL;
  const tdPassword = process.env.TD_AUTH_PASSWORD;

  if (!tdEmail || !tdPassword) {
    throw new Error('TD_EMAIL and TD_AUTH_PASSWORD must be set before running the simulation');
  }

  log('Authenticating...');
  const authRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: tdEmail, password: tdPassword }),
  });

  if (!authRes.ok) {
    throw new Error(`Auth failed: ${authRes.status}`);
  }

  const auth = await authRes.json();
  const token = auth.token;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  log(`Creating tournament ${config.slug}...`);
  const createTimer = time('create-tournament');
  const createTournamentRes = await fetch(`${baseUrl}/tournaments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Simulation Tournament ${config.slug}`,
      slug: config.slug,
      plannedCourtCount: config.courtCount,
    }),
  });
  createTimer.end();

  if (!createTournamentRes.ok) {
    throw new Error(`Failed to create tournament: ${createTournamentRes.status}`);
  }

  const tournament = await createTournamentRes.json();
  metrics.tournamentId = tournament.id;

  let totalMatchesScored = 0;

  for (const divisionConfig of config.divisions) {
    const metricKey = safeMetricKey(divisionConfig.name);

    log(`Creating division ${divisionConfig.name}...`);
    const divisionRes = await fetch(`${baseUrl}/tournaments/${config.slug}/divisions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: divisionConfig.name,
        level: divisionConfig.level,
        ageGroup: divisionConfig.ageGroup,
        format: divisionConfig.format,
      }),
    });

    if (!divisionRes.ok) {
      throw new Error(`Failed to create division: ${divisionConfig.name}`);
    }

    const division = await divisionRes.json();

    const teams = generateTeams(divisionConfig.teamCount, divisionConfig.name.split(' ')[0]);
    const csvHeader =
      'divisionName,divisionFormat,divisionLevel,divisionAgeGroup,teamName,player1First,player1Last,player1DOB,player2First,player2Last,player2DOB,seedNote\n';
    const csvRows = teams
      .map((team) =>
        [
          divisionConfig.name,
          divisionConfig.format,
          divisionConfig.level,
          divisionConfig.ageGroup,
          team.teamName,
          team.players[0].firstName,
          team.players[0].lastName,
          '',
          team.players[1].firstName,
          team.players[1].lastName,
          '',
          '',
        ].join(',')
      )
      .join('\n');

    const importPayload = csvHeader + csvRows;

    log(`Importing ${teams.length} teams for ${divisionConfig.name}...`);
    const importTimer = time(`import-${metricKey}`);
    const importRes = await fetch(`${baseUrl}/tournaments/${config.slug}/import`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ csv: importPayload }),
    });
    importTimer.end();

    if (!importRes.ok) {
      throw new Error(`Failed to import teams for division: ${divisionConfig.name}`);
    }

    log(`Creating bracket for ${divisionConfig.name}...`);
    const bracketRes = await fetch(`${baseUrl}/tournaments/${config.slug}/divisions/${division.id}/brackets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: divisionConfig.type,
        config:
          divisionConfig.type === 'SINGLE_ELIMINATION'
            ? {
                bestOf: 3,
                winBy2: true,
                rounds: [
                  { name: 'Round of 16', matchCount: 8 },
                  { name: 'Quarterfinals', matchCount: 4 },
                  { name: 'Semifinals', matchCount: 2 },
                  { name: 'Final', matchCount: 1 },
                ],
              }
            : {
                bestOf: 3,
                winBy2: true,
                groups: 4,
                groupSize: 4,
              },
      }),
    });

    if (!bracketRes.ok) {
      throw new Error(`Failed to create bracket for division: ${divisionConfig.name}`);
    }

    const bracket = await bracketRes.json();

    log(`Applying seedings for ${divisionConfig.name} (auto).`);
    const teamsRes = await fetch(
      `${baseUrl}/tournaments/${config.slug}/divisions/${division.id}/teams?bracketId=${bracket.id}`,
      {
        method: 'GET',
        headers,
      }
    );

    if (!teamsRes.ok) {
      throw new Error(`Failed to fetch teams for seeding in division: ${divisionConfig.name}`);
    }

    const teamsData = await teamsRes.json();
    const seedingPayload = {
      entries: teamsData.teams.map((team, index) => ({
        teamId: team.teamId,
        seed: index + 1,
      })),
    };

    const seedingRes = await fetch(`${baseUrl}/tournaments/${config.slug}/brackets/${bracket.id}/seeding`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(seedingPayload),
    });

    if (!seedingRes.ok) {
      throw new Error(`Failed to apply seedings for division: ${divisionConfig.name}`);
    }

    const seedingResult = await seedingRes.json();
    const matchesCreated = seedingResult?.generation?.matchesCreated ?? 0;
    const advancementsCreated = seedingResult?.generation?.advancementsCreated ?? 0;
    metrics[`matches-created-${metricKey}`] = matchesCreated;
    metrics[`advancements-created-${metricKey}`] = advancementsCreated;
    log(
      `Seeding applied for ${divisionConfig.name}: matches=${matchesCreated}, advancements=${advancementsCreated}`,
    );

    log(`Fetching bracket schedule for ${divisionConfig.name}`);
    const scheduleRes = await fetch(`${baseUrl}/tournaments/${config.slug}/brackets/${bracket.id}/schedule`, {
      method: 'GET',
      headers,
    });

    if (!scheduleRes.ok) {
      throw new Error(`Failed to fetch schedule for division: ${divisionConfig.name}`);
    }

    const schedule = await scheduleRes.json();
    if (!Array.isArray(schedule.queue)) {
      throw new Error(`Bracket schedule missing queue array for ${divisionConfig.name}`);
    }

    const queueMatches = schedule.queue;
    const availableCourts = schedule.courts.filter((court) => court.active && !court.assignment);

    const activeTeamIds = new Set();
    schedule.courts.forEach((court) => {
      const assignment = court.assignment;
      if (!assignment) {
        return;
      }
      const ids = [
        assignment.team1?.id ?? assignment.team1Id ?? null,
        assignment.team2?.id ?? assignment.team2Id ?? null,
      ].filter(Boolean);
      ids.forEach((id) => activeTeamIds.add(id));
    });

    log(`Assigning matches to courts for ${divisionConfig.name}`);
    let courtIndex = 0;
    let assignmentsMade = 0;

    for (const match of queueMatches) {
      if (!availableCourts[courtIndex]) {
        break;
      }

      if (!match.team1 || !match.team2) {
        continue;
      }

      const teamIds = [match.team1?.id, match.team2?.id].filter(Boolean);
      const hasActiveConflict = teamIds.some((teamId) => activeTeamIds.has(teamId));
      if (hasActiveConflict) {
        continue;
      }

      const assignmentRes = await fetch(
        `${baseUrl}/tournaments/${config.slug}/brackets/${bracket.id}/matches/${match.id}/assignment`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ courtId: availableCourts[courtIndex].id, startTime: new Date().toISOString() }),
        }
      );

      if (!assignmentRes.ok) {
        const errorText = await assignmentRes.text();
        throw new Error(
          `Failed to assign match to court (status ${assignmentRes.status}): ${errorText.slice(0, 200)}`,
        );
      }

      teamIds.forEach((teamId) => activeTeamIds.add(teamId));
      assignmentsMade += 1;
      courtIndex += 1;

      await delay(50);
    }

    log(`Assigned ${assignmentsMade} matches for ${divisionConfig.name}`);

    log(`Scoring matches for ${divisionConfig.name}`);
    const scoredMatches = new Set();
    const scoringTimer = time(`score-${metricKey}`);
    let iterations = 0;

    while (true) {
      iterations += 1;
      const matchesRes = await runWithRetry(`${baseUrl}/tournaments/${config.slug}/brackets/${bracket.id}/matches`, {
        method: 'GET',
        headers,
      });

      const matchPayload = await matchesRes.json();
      if (!Array.isArray(matchPayload.matches)) {
        throw new Error(`Unexpected matches payload for ${divisionConfig.name}`);
      }

      const pending = matchPayload.matches.filter(
        (match) => match.team1 && match.team2 && !match.winnerId && !scoredMatches.has(match.id)
      );

      if (pending.length === 0) {
        if (iterations === 1 && matchPayload.matches.length > 0) {
          log(
            `No scoreable matches yet for ${divisionConfig.name}; example payload: ${JSON.stringify(
              matchPayload.matches.slice(0, 3),
            )}`,
          );
        }
        break;
      }

      for (const match of pending) {
        const scorePayload = {
          games: [
            { team1: 11, team2: 8 },
            { team1: 11, team2: 6 },
          ],
        };

        const scoreRes = await runWithRetry(
          `${baseUrl}/tournaments/${config.slug}/brackets/${bracket.id}/matches/${match.id}/score`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify(scorePayload),
          },
          { retries: 5, delayMs: 75 }
        );

        if (!scoreRes.ok) {
          throw new Error('Failed to score match');
        }

        scoredMatches.add(match.id);
        await delay(25);
      }

      if (iterations > 50) {
        throw new Error('Exceeded maximum scoring iterations');
      }
    }

    scoringTimer.end();

    if (scoredMatches.size === 0) {
      throw new Error(
        `No scoreable matches found for ${divisionConfig.name}. Verify bracket matches are generated after seeding.`
      );
    }

    metrics[`matches-scored-${metricKey}`] = scoredMatches.size;
    totalMatchesScored += scoredMatches.size;
  }

  log('Fetching final standings...');
  const standingsRes = await runWithRetry(`${baseUrl}/public/${config.slug}/standings`, {
    method: 'GET',
  });
  if (!standingsRes.ok) {
    throw new Error('Failed to fetch public standings');
  }

  const queueRes = await runWithRetry(`${baseUrl}/public/${config.slug}/table`, {
    method: 'GET',
  });
  if (!queueRes.ok) {
    throw new Error('Failed to fetch public queue table');
  }

  const playersRes = await runWithRetry(`${baseUrl}/public/${config.slug}/players`, {
    method: 'GET',
  });
  if (!playersRes.ok) {
    throw new Error('Failed to fetch public players directory');
  }

  metrics.totalDuration = Date.now() - startTime;
  metrics.matchesScored = totalMatchesScored;
  metrics.timestamp = new Date().toISOString();

  console.log('Simulation complete. Metrics:', JSON.stringify(metrics, null, 2));
}

main().catch((error) => {
  console.error('Simulation failed:', error);
  process.exit(1);
});
