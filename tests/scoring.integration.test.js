const request = require('supertest');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');

const authHeaders = async () => {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: process.env.TD_EMAIL,
      password: process.env.TD_AUTH_PASSWORD,
    });

  return { Authorization: `Bearer ${response.body.token}` };
};

async function bootstrapScoringFixture(slug = 'scoring-test') {
  const headers = await authHeaders();

  await request(app)
    .post('/api/v1/tournaments')
    .set(headers)
    .send({
      name: `Tournament ${slug}`,
      slug,
      plannedCourtCount: 1,
    });

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      courts: true,
    },
  });

  const division = await prisma.division.create({
    data: {
      name: 'Score Test Division',
      level: 'INT',
      ageGroup: 'A18',
      format: 'DOUBLE',
      tournamentId: tournament.id,
    },
  });

  const bracketResponse = await request(app)
    .post(`/api/v1/tournaments/${tournament.slug}/divisions/${division.id}/brackets`)
    .set(headers)
    .send({
      type: 'SINGLE_ELIMINATION',
      config: {
        bestOf: 3,
        winBy2: true,
        rounds: [
          { name: 'Final', matchCount: 1 },
        ],
      },
    });

  const bracket = bracketResponse.body;

  const teamOne = await prisma.team.create({ data: { name: 'Team One' } });
  const teamTwo = await prisma.team.create({ data: { name: 'Team Two' } });

  const aliceAlpha = await prisma.player.create({ data: { firstName: 'Alice', lastName: 'Alpha' } });
  const annieAce = await prisma.player.create({ data: { firstName: 'Annie', lastName: 'Ace' } });
  const barbaraBaseline = await prisma.player.create({ data: { firstName: 'Barbara', lastName: 'Baseline' } });
  const bobBravo = await prisma.player.create({ data: { firstName: 'Bob', lastName: 'Bravo' } });

  await prisma.teamPlayer.createMany({
    data: [
      { teamId: teamOne.id, playerId: aliceAlpha.id },
      { teamId: teamOne.id, playerId: annieAce.id },
      { teamId: teamTwo.id, playerId: barbaraBaseline.id },
      { teamId: teamTwo.id, playerId: bobBravo.id },
    ],
    skipDuplicates: true,
  });

  await prisma.registration.createMany({
    data: [
      { divisionId: division.id, teamId: teamOne.id, entryCode: 'ONE_001' },
      { divisionId: division.id, teamId: teamTwo.id, entryCode: 'TWO_002' },
    ],
  });

  const match = await prisma.match.create({
    data: {
      bracketId: bracket.id,
      team1Id: teamOne.id,
      team2Id: teamTwo.id,
    },
  });

  const finalMatch = await prisma.match.create({
    data: {
      bracketId: bracket.id,
    },
  });

  await prisma.matchAdvancement.create({
    data: {
      fromMatchId: match.id,
      toMatchId: finalMatch.id,
      placement: 'WINNER',
      slot: 1,
    },
  });

  return {
    headers,
    tournament,
    division,
    bracket,
    teams: {
      teamOne,
      teamTwo,
    },
    match,
    finalMatch,
  };
}

async function bootstrapRoundRobinFixture(slug = 'rr-test') {
  const headers = await authHeaders();

  await request(app)
    .post('/api/v1/tournaments')
    .set(headers)
    .send({ name: `Tournament ${slug}`, slug });

  const tournament = await prisma.tournament.findUnique({ where: { slug } });

  const division = await prisma.division.create({
    data: {
      name: 'Round Robin Division',
      level: 'ADV',
      ageGroup: 'A18',
      format: 'ROUND_ROBIN',
      tournamentId: tournament.id,
    },
  });

  const bracketResponse = await request(app)
    .post(`/api/v1/tournaments/${tournament.slug}/divisions/${division.id}/brackets`)
    .set(headers)
    .send({
      type: 'ROUND_ROBIN',
      config: {
        bestOf: 3,
        winBy2: true,
        groups: 1,
        groupSize: 3,
      },
    });

  const bracket = bracketResponse.body;

  const teamA = await prisma.team.create({ data: { name: 'Team A' } });
  const teamB = await prisma.team.create({ data: { name: 'Team B' } });
  const teamC = await prisma.team.create({ data: { name: 'Team C' } });

  await prisma.registration.createMany({
    data: [
      { divisionId: division.id, teamId: teamA.id, entryCode: 'A_001' },
      { divisionId: division.id, teamId: teamB.id, entryCode: 'B_002' },
      { divisionId: division.id, teamId: teamC.id, entryCode: 'C_003' },
    ],
  });

  const matchAB = await prisma.match.create({
    data: {
      bracketId: bracket.id,
      team1Id: teamA.id,
      team2Id: teamB.id,
    },
  });

  const matchCA = await prisma.match.create({
    data: {
      bracketId: bracket.id,
      team1Id: teamC.id,
      team2Id: teamA.id,
    },
  });

  const matchBC = await prisma.match.create({
    data: {
      bracketId: bracket.id,
      team1Id: teamB.id,
      team2Id: teamC.id,
    },
  });

  return {
    headers,
    tournament,
    division,
    bracket,
    teams: { teamA, teamB, teamC },
    matches: { matchAB, matchCA, matchBC },
  };
}

describe('Scoring routes', () => {
  test('submits a best-of-3 score with win-by-2 enforcement', async () => {
  const { tournament, division, bracket, match, finalMatch, teams, headers } =
      await bootstrapScoringFixture('score-success');

    const response = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/${match.id}/score`)
      .set(headers)
      .send({
        games: [
          { team1: 11, team2: 8 },
          { team1: 11, team2: 9 },
        ],
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('COMPLETED');
    expect(response.body.winnerId).toBe(teams.teamOne.id);
    expect(response.body.score.games).toHaveLength(2);
    expect(response.body.score.bestOf).toBe(3);

    const persisted = await prisma.match.findUnique({
      where: { id: match.id },
    });

    expect(persisted.winnerId).toBe(teams.teamOne.id);
    expect(persisted.courtId).toBeNull();
    expect(persisted.score).toMatchObject({
      games: [
        { team1: 11, team2: 8 },
        { team1: 11, team2: 9 },
      ],
      bestOf: 3,
      winBy2: true,
    });

    const advanced = await prisma.match.findUnique({
      where: { id: finalMatch.id },
    });

    expect(advanced.team1Id).toBe(teams.teamOne.id);
    expect(advanced.team2Id).toBeNull();

    const standings = await prisma.standing.findMany({
      where: { bracketId: bracket.id },
      orderBy: { rank: 'asc' },
    });

    expect(standings).toHaveLength(2);
    expect(standings[0]).toMatchObject({
      teamId: teams.teamOne.id,
      wins: 1,
      losses: 0,
      pointsFor: 22,
      pointsAgainst: 17,
      rank: 1,
    });
    expect(Number(standings[0].quotient)).toBeCloseTo(22 / 17, 4);
    expect(standings[1]).toMatchObject({
      teamId: teams.teamTwo.id,
      wins: 0,
      losses: 1,
      pointsFor: 17,
      pointsAgainst: 22,
      rank: 2,
    });

    const standingsResponse = await request(app)
      .get(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/standings`)
      .set(headers);

    expect(standingsResponse.statusCode).toBe(200);
    expect(standingsResponse.body.bracketId).toBe(bracket.id);
    expect(Array.isArray(standingsResponse.body.standings)).toBe(true);
    expect(standingsResponse.body.standings[0].teamId).toBe(teams.teamOne.id);

    const matchDetailResponse = await request(app)
      .get(`/api/v1/tournaments/${tournament.slug}/matches/${match.id}`)
      .set(headers);

    expect(matchDetailResponse.statusCode).toBe(200);
    expect(matchDetailResponse.body.id).toBe(match.id);
    expect(matchDetailResponse.body.team1.entryCode).toBe('ONE_001');
    expect(matchDetailResponse.body.team2.entryCode).toBe('TWO_002');

    const publicStandingsResponse = await request(app)
      .get(`/api/v1/public/${tournament.slug}/standings`);

    expect(publicStandingsResponse.statusCode).toBe(200);
    expect(publicStandingsResponse.body.tournamentId).toBe(tournament.id);
    expect(Array.isArray(publicStandingsResponse.body.divisions)).toBe(true);
    const divisionEntry = publicStandingsResponse.body.divisions.find((item) => item.id === division.id);
    expect(divisionEntry).toBeDefined();
    const bracketEntry = divisionEntry?.brackets.find((item) => item.id === bracket.id);
    expect(bracketEntry?.standings).toHaveLength(2);

    const publicPlayersResponse = await request(app)
      .get(`/api/v1/public/${tournament.slug}/players`);

    expect(publicPlayersResponse.statusCode).toBe(200);
    const playersDivision = publicPlayersResponse.body.divisions.find((item) => item.id === division.id);
    expect(playersDivision).toBeDefined();
    const teamEntry = playersDivision?.teams.find((team) => team.teamId === teams.teamOne.id);
    expect(teamEntry?.players.length).toBeGreaterThanOrEqual(2);

    const publicQueueResponse = await request(app)
      .get(`/api/v1/public/${tournament.slug}/table`);

    expect(publicQueueResponse.statusCode).toBe(200);
    expect(Array.isArray(publicQueueResponse.body.courts)).toBe(true);
    const queueDivision = publicQueueResponse.body.divisions.find((item) => item.id === division.id);
    expect(queueDivision).toBeDefined();

    const publicBracketsResponse = await request(app)
      .get(`/api/v1/public/${tournament.slug}/brackets`);

    expect(publicBracketsResponse.statusCode).toBe(200);
    const bracketsDivision = publicBracketsResponse.body.divisions.find((item) => item.id === division.id);
    expect(bracketsDivision).toBeDefined();
    const publicBracket = bracketsDivision?.brackets.find((entry) => entry.id === bracket.id);
    expect(publicBracket?.matches.length).toBeGreaterThan(0);
  });

  test('rejects scores that are not won by two points when required', async () => {
    const { tournament, bracket, match, headers } = await bootstrapScoringFixture('score-winby2');

    const response = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/${match.id}/score`)
      .set(headers)
      .send({
        games: [
          { team1: 11, team2: 10 },
          { team1: 11, team2: 9 },
        ],
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toMatch(/must be won by at least 2 points/);
  });

  test('prevents resubmitting a score for a completed match', async () => {
    const { tournament, bracket, match, teams, headers } = await bootstrapScoringFixture('score-repeat');

    const first = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/${match.id}/score`)
      .set(headers)
      .send({
        games: [
          { team1: 11, team2: 5 },
          { team1: 11, team2: 7 },
        ],
      });

    expect(first.statusCode).toBe(200);
    expect(first.body.winnerId).toBe(teams.teamOne.id);

    const repeat = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/${match.id}/score`)
      .set(headers)
      .send({
        games: [
          { team1: 11, team2: 9 },
          { team1: 10, team2: 12 },
          { team1: 11, team2: 6 },
        ],
      });

    expect(repeat.statusCode).toBe(409);
    expect(repeat.body.error).toMatch(/already been completed/);
  });

  test('prevents auto-advance when target slot already filled by another team', async () => {
    const { tournament, bracket, division, match, finalMatch, headers } =
      await bootstrapScoringFixture('score-conflict');

    const outsider = await prisma.team.create({ data: { name: 'Team Outsider' } });
    await prisma.registration.create({
      data: {
        divisionId: division.id,
        teamId: outsider.id,
        entryCode: 'OUT_999',
      },
    });

    await prisma.match.update({
      where: { id: finalMatch.id },
      data: { team1Id: outsider.id },
    });

    const response = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/${match.id}/score`)
      .set(headers)
      .send({
        games: [
          { team1: 11, team2: 8 },
          { team1: 11, team2: 9 },
        ],
      });

    expect(response.statusCode).toBe(409);
    expect(response.body.error).toMatch(/already has a different team assigned/);

    const persistedMatch = await prisma.match.findUnique({ where: { id: match.id } });
    expect(persistedMatch.winnerId).toBeNull();

    const target = await prisma.match.findUnique({ where: { id: finalMatch.id } });
    expect(target.team1Id).toBe(outsider.id);
    expect(target.team2Id).toBeNull();

    const standings = await prisma.standing.findMany({ where: { bracketId: bracket.id } });
    expect(standings).toHaveLength(0);
  });

  test('round robin standings use quotient tiebreaker', async () => {
    const { tournament, division, bracket, matches, teams, headers } =
      await bootstrapRoundRobinFixture('rr-tiebreak');

    const { matchAB, matchCA, matchBC } = matches;

    await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/${matchAB.id}/score`)
      .set(headers)
      .send({
        games: [
          { team1: 11, team2: 9 },
          { team1: 11, team2: 7 },
        ],
      });

    await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/${matchCA.id}/score`)
      .set(headers)
      .send({
        games: [
          { team1: 11, team2: 6 },
          { team1: 11, team2: 7 },
        ],
      });

    await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/${matchBC.id}/score`)
      .set(headers)
      .send({
        games: [
          { team1: 11, team2: 8 },
          { team1: 11, team2: 9 },
        ],
      });

    const standings = await prisma.standing.findMany({
      where: { bracketId: bracket.id },
      orderBy: { rank: 'asc' },
    });

    expect(standings).toHaveLength(3);
    expect(standings[0].teamId).toBe(teams.teamC.id);
    expect(standings[1].teamId).toBe(teams.teamB.id);
    expect(standings[2].teamId).toBe(teams.teamA.id);

    const quotientTop = Number(standings[0].quotient);
    const quotientSecond = Number(standings[1].quotient);
    const quotientThird = Number(standings[2].quotient);

    expect(quotientTop).toBeGreaterThan(quotientSecond);
    expect(quotientSecond).toBeGreaterThan(quotientThird);
  });
});
