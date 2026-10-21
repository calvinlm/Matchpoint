// End-to-end through the API against the test database: seeding → schedule → scoring → standings.
const { prisma, resetDatabase } = require('../helpers/db');
const { api, createTournamentWithTeams, createSeededRoundRobin } = require('../helpers/api');

const SLUG = 'rr-integration';

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

test('a 6-team round robin schedules every pair exactly once', async () => {
  const setup = await createTournamentWithTeams({ slug: SLUG, teamCount: 6 });
  const bracket = await createSeededRoundRobin(setup);

  const matches = await prisma.match.findMany({ where: { bracketId: bracket.id } });
  expect(matches).toHaveLength(15);

  const pairs = new Set(matches.map((m) => [m.team1Id, m.team2Id].sort().join('|')));
  expect(pairs.size).toBe(15);
  matches.forEach((m) => expect(m.team1Id).not.toBe(m.team2Id));
});

test('two groups split teams and only schedule within each group', async () => {
  const setup = await createTournamentWithTeams({ slug: SLUG, teamCount: 8 });
  const bracket = await createSeededRoundRobin({ ...setup, config: { groups: 2, groupSize: 4 } });

  const matches = await prisma.match.findMany({ where: { bracketId: bracket.id } });
  expect(matches).toHaveLength(12); // 6 per group of 4
});

test('scoring a match updates winner, standings and the schedule', async () => {
  const setup = await createTournamentWithTeams({ slug: SLUG, teamCount: 4 });
  const bracket = await createSeededRoundRobin(setup);
  const [match] = await prisma.match.findMany({ where: { bracketId: bracket.id }, orderBy: { createdAt: 'asc' } });

  const scored = await api('patch', `/api/v1/tournaments/${SLUG}/brackets/${bracket.id}/matches/${match.id}/score`).send({
    games: [{ team1: 11, team2: 7 }],
  });
  expect(scored.status).toBe(200);
  expect(scored.body).toMatchObject({ winnerId: match.team1Id, status: 'COMPLETED' });

  const standings = await prisma.standing.findMany({ where: { bracketId: bracket.id } });
  const winner = standings.find((s) => s.teamId === match.team1Id);
  const loser = standings.find((s) => s.teamId === match.team2Id);
  expect(winner).toMatchObject({ wins: 1, losses: 0, pointsFor: 11, pointsAgainst: 7 });
  expect(loser).toMatchObject({ wins: 0, losses: 1, pointsFor: 7, pointsAgainst: 11 });

  const again = await api('patch', `/api/v1/tournaments/${SLUG}/brackets/${bracket.id}/matches/${match.id}/score`).send({
    games: [{ team1: 7, team2: 11 }],
  });
  // Known gap (audit B2): a submitted score can't be corrected. Phase 1 adds score correction.
  expect(again.status).toBe(409);
});

test('an invalid score is rejected and nothing is saved', async () => {
  const setup = await createTournamentWithTeams({ slug: SLUG, teamCount: 4 });
  const bracket = await createSeededRoundRobin(setup);
  const [match] = await prisma.match.findMany({ where: { bracketId: bracket.id } });

  const response = await api('patch', `/api/v1/tournaments/${SLUG}/brackets/${bracket.id}/matches/${match.id}/score`).send({
    games: [{ team1: 11, team2: 10 }],
  });
  expect(response.status).toBe(400);

  const unchanged = await prisma.match.findUnique({ where: { id: match.id } });
  expect(unchanged.winnerId).toBeNull();
});

test('requests without a token are refused', async () => {
  const request = require('supertest');
  const app = require('../../app');
  const response = await request(app).post('/api/v1/tournaments').send({ name: 'X', slug: 'x' });
  expect(response.status).toBe(401);
});
