const request = require('supertest');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');

const authHeaders = async () => {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: process.env.TD_EMAIL, password: process.env.TD_AUTH_PASSWORD });

  return { Authorization: `Bearer ${response.body.token}` };
};

async function createTournamentWithDivision(slug = 'bracket-test', divisionName = 'Men Doubles') {
  const headers = await authHeaders();

  await request(app)
    .post('/api/v1/tournaments')
    .set(headers)
    .send({ name: `Tournament ${slug}`, slug });

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
  });

  const division = await prisma.division.create({
    data: {
      name: divisionName,
      level: 'INT',
      ageGroup: 'A18',
      format: 'DOUBLE',
      tournamentId: tournament.id,
    },
  });

  return { tournament, division, headers };
}

describe('Bracket routes', () => {
  test('creates a single elimination bracket with config', async () => {
    const { tournament, division, headers } = await createTournamentWithDivision('single-elim', "Men's Doubles");

    const response = await request(app)
      .post(`/api/v1/tournaments/${tournament.slug}/divisions/${division.id}/brackets`)
      .set(headers)
      .send({
        type: 'SINGLE_ELIMINATION',
        config: {
          bestOf: 3,
          winBy2: true,
          rounds: [
            { name: 'Quarterfinals', matchCount: 4 },
            { name: 'Semifinals', matchCount: 2 },
            { name: 'Final', matchCount: 1 },
          ],
        },
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.type).toBe('SINGLE_ELIMINATION');
    expect(response.body.locked).toBe(false);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'BRACKET_CREATE', resourceId: response.body.id },
    });
    expect(audit).not.toBeNull();
  });

  test('rejects invalid bracket config', async () => {
    const { tournament, division, headers } = await createTournamentWithDivision('invalid-bracket', 'Mixed Doubles');

    const response = await request(app)
      .post(`/api/v1/tournaments/${tournament.slug}/divisions/${division.id}/brackets`)
      .set(headers)
      .send({
        type: 'SINGLE_ELIMINATION',
        config: {
          rounds: [],
        },
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toMatch(/config.rounds must be a non-empty array/);
  });

  test('updates bracket config unless locked', async () => {
    const { tournament, division, headers } = await createTournamentWithDivision('update-bracket', 'Women Doubles');

    const createResponse = await request(app)
      .post(`/api/v1/tournaments/${tournament.slug}/divisions/${division.id}/brackets`)
      .set(headers)
      .send({
        type: 'ROUND_ROBIN',
        config: {
          bestOf: 3,
          winBy2: false,
          groups: 2,
          groupSize: 4,
        },
      });

    const bracketId = createResponse.body.id;

    const patchResponse = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracketId}`)
      .set(headers)
      .send({
        config: {
          bestOf: 5,
          winBy2: true,
          groups: 3,
          groupSize: 5,
        },
        locked: true,
      });

    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.body.config).toMatchObject({
      bestOf: 5,
      winBy2: true,
      groups: 3,
      groupSize: 5,
    });
    expect(patchResponse.body.locked).toBe(true);

    const lockedUpdate = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracketId}`)
      .set(headers)
      .send({
        config: {
          bestOf: 7,
          winBy2: true,
          groups: 3,
          groupSize: 5,
        },
      });

    expect(lockedUpdate.statusCode).toBe(409);
    expect(lockedUpdate.body.error).toMatch(/Bracket is locked/);
  });

  test('lists brackets for tournament', async () => {
    const { tournament, division, headers } = await createTournamentWithDivision('list-brackets', 'Open Doubles');

    await request(app)
      .post(`/api/v1/tournaments/${tournament.slug}/divisions/${division.id}/brackets`)
      .set(headers)
      .send({
        type: 'DOUBLE_ELIMINATION',
        config: {
          bestOf: 3,
          winBy2: true,
          rounds: [
            { name: 'Winners Round 1', matchCount: 4 },
            { name: 'Winners Round 2', matchCount: 2 },
          ],
          finalsReset: true,
        },
      });

    const listResponse = await request(app).get(`/api/v1/tournaments/${tournament.slug}/brackets`);
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.body.length).toBe(1);
    expect(listResponse.body[0].divisionId).toBe(division.id);
  });
});

  test('applies seeding when bracket unlocked', async () => {
    const { tournament, division, headers } = await createTournamentWithDivision('seeding-test', 'Test Division');

    const createResponse = await request(app)
      .post(`/api/v1/tournaments/${tournament.slug}/divisions/${division.id}/brackets`)
      .set(headers)
      .send({
        type: 'SINGLE_ELIMINATION',
        config: {
          bestOf: 3,
          winBy2: true,
          rounds: [{ name: 'Final', matchCount: 1 }],
        },
      });

    const bracketId = createResponse.body.id;

    const teamA = await prisma.team.create({ data: { name: 'Team A' } });
    const teamB = await prisma.team.create({ data: { name: 'Team B' } });

    await prisma.registration.createMany({
      data: [
        {
          divisionId: division.id,
          teamId: teamA.id,
          entryCode: 'TESTA_001',
        },
        {
          divisionId: division.id,
          teamId: teamB.id,
          entryCode: 'TESTB_002',
        },
      ],
    });

    const response = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracketId}/seeding`)
      .set(headers)
      .send({
        entries: [
          { teamId: teamA.id, seed: 1 },
          { teamId: teamB.id, seed: 2 },
        ],
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.entries).toHaveLength(2);
    expect(response.body.generation.matchesCreated).toBe(1);
    expect(response.body.generation.advancementsCreated).toBe(0);

    const seedingRows = await prisma.bracketSeeding.findMany({
      where: { bracketId },
      orderBy: { seed: 'asc' },
    });

    expect(seedingRows.map((row) => row.teamId)).toEqual([teamA.id, teamB.id]);

    const matches = await prisma.match.findMany({ where: { bracketId }, orderBy: { createdAt: 'asc' } });
    expect(matches).toHaveLength(1);
    expect(matches[0].team1Id).toBe(teamA.id);
    expect(matches[0].team2Id).toBe(teamB.id);
  });

  test('generates round robin matches after seeding', async () => {
    const { tournament, division, headers } = await createTournamentWithDivision('rr-seeding', 'Round Robin Division');

    const createResponse = await request(app)
      .post(`/api/v1/tournaments/${tournament.slug}/divisions/${division.id}/brackets`)
      .set(headers)
      .send({
        type: 'ROUND_ROBIN',
        config: {
          bestOf: 3,
          winBy2: true,
          groups: 2,
          groupSize: 2,
        },
      });

    const bracketId = createResponse.body.id;

    const teams = await Promise.all(
      ['Alpha', 'Bravo', 'Charlie', 'Delta'].map((name) => prisma.team.create({ data: { name: `RR ${name}` } })),
    );

    await prisma.registration.createMany({
      data: teams.map((team, index) => ({
        divisionId: division.id,
        teamId: team.id,
        entryCode: `RR_${String(index + 1).padStart(3, '0')}`,
      })),
    });

    const response = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracketId}/seeding`)
      .set(headers)
      .send({
        entries: teams.map((team, index) => ({
          teamId: team.id,
          seed: index + 1,
        })),
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.generation.matchesCreated).toBe(2);
    expect(response.body.generation.advancementsCreated).toBe(0);

    const matches = await prisma.match.findMany({
      where: { bracketId },
      orderBy: { createdAt: 'asc' },
    });

    expect(matches).toHaveLength(2);
    matches.forEach((match) => {
      expect(match.team1Id).not.toBeNull();
      expect(match.team2Id).not.toBeNull();
    });
  });

  test('rejected seeding when bracket locked', async () => {
    const { tournament, division, headers } = await createTournamentWithDivision('locked-seeding', 'Locked Division');

    const createResponse = await request(app)
      .post(`/api/v1/tournaments/${tournament.slug}/divisions/${division.id}/brackets`)
      .set(headers)
      .send({
        type: 'SINGLE_ELIMINATION',
        config: {
          bestOf: 3,
          winBy2: true,
          rounds: [{ name: 'Final', matchCount: 1 }],
        },
      });

    const bracketId = createResponse.body.id;

    await prisma.bracket.update({
      where: { id: bracketId },
      data: { locked: true },
    });

    const teamA = await prisma.team.create({ data: { name: 'Locked Team A' } });

    await prisma.registration.create({
      data: {
        divisionId: division.id,
        teamId: teamA.id,
        entryCode: 'LOCKED_001',
      },
    });

    const response = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracketId}/seeding`)
      .set(headers)
      .send({
        entries: [{ teamId: teamA.id, seed: 1 }],
      });

    expect(response.statusCode).toBe(409);
    expect(response.body.error).toMatch(/Bracket is locked/);
  });

  test('seeding validation checks duplicates', async () => {
    const { tournament, division, headers } = await createTournamentWithDivision('duplicate-seeding', 'Duplicate Division');

    const createResponse = await request(app)
      .post(`/api/v1/tournaments/${tournament.slug}/divisions/${division.id}/brackets`)
      .set(headers)
      .send({
        type: 'SINGLE_ELIMINATION',
        config: {
          bestOf: 3,
          winBy2: true,
          rounds: [{ name: 'Final', matchCount: 1 }],
        },
      });

    const bracketId = createResponse.body.id;
    const teamA = await prisma.team.create({ data: { name: 'Dup Team A' } });
    const teamB = await prisma.team.create({ data: { name: 'Dup Team B' } });

    await prisma.registration.createMany({
      data: [
        {
          divisionId: division.id,
          teamId: teamA.id,
          entryCode: 'DUPA_001',
        },
        {
          divisionId: division.id,
          teamId: teamB.id,
          entryCode: 'DUPB_002',
        },
      ],
    });

    const response = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracketId}/seeding`)
      .set(headers)
      .send({
        entries: [
          { teamId: teamA.id, seed: 1 },
          { teamId: teamB.id, seed: 1 },
        ],
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toMatch(/Duplicate seed value/);
  });

  test('lists division teams with optional seeding info', async () => {
    const { tournament, division, headers } = await createTournamentWithDivision('division-teams', 'Division Teams');

    const createdBracket = await request(app)
      .post(`/api/v1/tournaments/${tournament.slug}/divisions/${division.id}/brackets`)
      .set(headers)
      .send({
        type: 'ROUND_ROBIN',
        config: {
          bestOf: 3,
          winBy2: true,
          groups: 2,
          groupSize: 4,
        },
      });

    const bracketId = createdBracket.body.id;

    const teamA = await prisma.team.create({ data: { name: 'Division Team A' } });
    const teamB = await prisma.team.create({ data: { name: 'Division Team B' } });

    await prisma.registration.createMany({
      data: [
        { divisionId: division.id, teamId: teamA.id, entryCode: 'DIV_A_001' },
        { divisionId: division.id, teamId: teamB.id, entryCode: 'DIV_B_002' },
      ],
    });

    const playerA = await prisma.player.create({ data: { firstName: 'Alice', lastName: 'Alpha' } });
    const playerB = await prisma.player.create({ data: { firstName: 'Bob', lastName: 'Beta' } });

    await prisma.teamPlayer.createMany({
      data: [
        { teamId: teamA.id, playerId: playerA.id },
        { teamId: teamB.id, playerId: playerB.id },
      ],
    });

    await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracketId}/seeding`)
      .set(headers)
      .send({
        entries: [
          { teamId: teamA.id, seed: 1 },
          { teamId: teamB.id, seed: 2 },
        ],
      });

    const response = await request(app)
      .get(`/api/v1/tournaments/${tournament.slug}/divisions/${division.id}/teams?bracketId=${bracketId}`)
      .set(headers);

    expect(response.statusCode).toBe(200);
    expect(response.body.teams).toHaveLength(2);
    expect(response.body.teams.map((team) => team.seed)).toEqual([1, 2]);
  });
