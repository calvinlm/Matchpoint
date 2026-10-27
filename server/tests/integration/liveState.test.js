// Live queue state (match status, queue order, bracket pause) lives in the database, not in memory (P1-1, audit B1).
const { prisma, resetDatabase } = require('../helpers/db');
const { api, createTournamentWithTeams, createSeededRoundRobin } = require('../helpers/api');

const SLUG = 'live-state';

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function scheduleUrl(bracketId) {
  return `/api/v1/tournaments/${SLUG}/brackets/${bracketId}/schedule`;
}

function bracketUrl(bracketId, path) {
  return `/api/v1/tournaments/${SLUG}/brackets/${bracketId}/${path}`;
}

test('T02: retired, reordered and paused state survives a restart', async () => {
  const setup = await createTournamentWithTeams({ slug: SLUG, teamCount: 4 });
  const bracket = await createSeededRoundRobin(setup);

  const before = await api('get', scheduleUrl(bracket.id));
  expect(before.status).toBe(200);
  expect(before.body.queue).toHaveLength(6);
  const [retiredId, ...remaining] = before.body.queue.map((match) => match.id);
  const movedId = remaining[remaining.length - 1];
  const courtId = before.body.courts[0].id;

  const retired = await api('post', bracketUrl(bracket.id, 'matches/retire')).send({ matchIds: [retiredId] });
  expect(retired.status).toBe(200);
  expect(retired.body.matches[0]).toMatchObject({ id: retiredId, status: 'RETIRED' });

  const reordered = await api('patch', bracketUrl(bracket.id, 'queue/reorder')).send({
    order: [movedId, ...remaining.slice(0, -1)],
  });
  expect(reordered.status).toBe(200);

  const paused = await api('patch', bracketUrl(bracket.id, 'queue')).send({ paused: true });
  expect(paused.status).toBe(200);
  expect(paused.body).toMatchObject({ queuePaused: true });

  // Simulate an API restart: a fresh module registry rebuilds the app and every module-level variable.
  jest.resetModules();
  const restarted = require('../helpers/api');
  const restartedPrisma = require('../../src/lib/prisma');

  try {
    const after = await restarted.api('get', scheduleUrl(bracket.id));
    expect(after.status).toBe(200);
    expect(after.body.queuePaused).toBe(true);

    const queueIds = after.body.queue.map((match) => match.id);
    expect(queueIds).toHaveLength(5);
    expect(queueIds).not.toContain(retiredId);
    expect(queueIds[0]).toBe(movedId);
    after.body.queue.forEach((match) => {
      expect(match.status).toBe('PENDING');
      expect(Number.isInteger(match.priority)).toBe(true);
    });
    expect(after.body.queue[0].priority).toBeGreaterThan(after.body.queue[1].priority);

    const retiredRow = await prisma.match.findUnique({ where: { id: retiredId } });
    expect(retiredRow.status).toBe('RETIRED');

    const blocked = await restarted.api('patch', bracketUrl(bracket.id, `matches/${movedId}/assignment`)).send({ courtId });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe("This bracket's queue is paused");

    const resumed = await restarted.api('patch', bracketUrl(bracket.id, 'queue')).send({ paused: false });
    expect(resumed.status).toBe(200);

    const assigned = await restarted.api('patch', bracketUrl(bracket.id, `matches/${movedId}/assignment`)).send({ courtId });
    expect(assigned.status).toBe(200);
    expect(assigned.body).toMatchObject({ id: movedId, courtId, status: 'ACTIVE' });
  } finally {
    await restartedPrisma.$disconnect();
  }
});

test('match status follows assign, unassign, swap and score', async () => {
  const setup = await createTournamentWithTeams({ slug: SLUG, teamCount: 4 });
  const bracket = await createSeededRoundRobin(setup);
  const schedule = await api('get', scheduleUrl(bracket.id));
  const [court1, court2] = schedule.body.courts.map((court) => court.id);

  // Two matches with no team in common, so both can be on court at once.
  const teamsOf = (match) => [match.team1?.id, match.team2?.id];
  const [firstMatch] = schedule.body.queue;
  const lastMatch = schedule.body.queue.find((match) => !teamsOf(match).some((id) => teamsOf(firstMatch).includes(id)));
  const first = firstMatch.id;
  const last = lastMatch.id;

  const assignFirst = await api('patch', bracketUrl(bracket.id, `matches/${first}/assignment`)).send({ courtId: court1 });
  expect(assignFirst.status).toBe(200);
  let row = await prisma.match.findUnique({ where: { id: first } });
  expect(row).toMatchObject({ status: 'ACTIVE', courtId: court1 });
  expect(row.startedAt).toBeInstanceOf(Date);

  const unassign = await api('patch', bracketUrl(bracket.id, `matches/${first}/assignment`)).send({ courtId: null });
  expect(unassign.status).toBe(200);
  row = await prisma.match.findUnique({ where: { id: first } });
  expect(row).toMatchObject({ status: 'PENDING', courtId: null, startedAt: null });

  await api('patch', bracketUrl(bracket.id, `matches/${first}/assignment`)).send({ courtId: court1 });
  await api('patch', bracketUrl(bracket.id, `matches/${last}/assignment`)).send({ courtId: court2 });

  const swapped = await api('post', bracketUrl(bracket.id, 'matches/swap')).send({ matchAId: first, matchBId: last });
  expect(swapped.status).toBe(200);
  const afterSwap = await prisma.match.findMany({ where: { id: { in: [first, last] } } });
  afterSwap.forEach((match) => expect(match.status).toBe('ACTIVE'));
  expect(afterSwap.find((match) => match.id === first).courtId).toBe(court2);

  const scored = await api('patch', bracketUrl(bracket.id, `matches/${first}/score`)).send({ games: [{ team1: 11, team2: 5 }] });
  expect(scored.status).toBe(200);
  row = await prisma.match.findUnique({ where: { id: first } });
  expect(row).toMatchObject({ status: 'COMPLETED', courtId: null });
  expect(row.completedAt).toBeInstanceOf(Date);

  const retireCompleted = await api('post', bracketUrl(bracket.id, 'matches/retire')).send({ matchIds: [first] });
  expect(retireCompleted.status).toBe(409);
});

test('pausing a bracket still lets the director clear a match from its court', async () => {
  const setup = await createTournamentWithTeams({ slug: SLUG, teamCount: 4 });
  const bracket = await createSeededRoundRobin(setup);
  const schedule = await api('get', scheduleUrl(bracket.id));
  const [court1, court2] = schedule.body.courts.map((court) => court.id);
  const [first] = schedule.body.queue.map((match) => match.id);

  await api('patch', bracketUrl(bracket.id, `matches/${first}/assignment`)).send({ courtId: court1 });
  await api('patch', bracketUrl(bracket.id, 'queue')).send({ paused: true });

  const moved = await api('patch', bracketUrl(bracket.id, `matches/${first}/assignment`)).send({ courtId: court2 });
  expect(moved.status).toBe(200);

  const cleared = await api('patch', bracketUrl(bracket.id, `matches/${first}/assignment`)).send({ courtId: null });
  expect(cleared.status).toBe(200);
  expect(cleared.body.status).toBe('PENDING');
});
