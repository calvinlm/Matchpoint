const request = require('supertest');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');

const authHeaders = async () => {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: process.env.TD_EMAIL, password: process.env.TD_AUTH_PASSWORD });

  return { Authorization: `Bearer ${response.body.token}` };
};

async function bootstrapSchedulingFixture(slug = 'schedule-test') {
  const headers = await authHeaders();

  await request(app)
    .post('/api/v1/tournaments')
    .set(headers)
    .send({ name: `Tournament ${slug}`, slug, plannedCourtCount: 2 });

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      courts: true,
    },
  });

  // ensure courts are sorted by label for deterministic order
  tournament.courts.sort((a, b) => Number(a.label) - Number(b.label));

  const division = await prisma.division.create({
    data: {
      name: 'Competitive Doubles',
      level: 'ADV',
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
          { name: 'Semifinals', matchCount: 2 },
          { name: 'Final', matchCount: 1 },
        ],
      },
    });

  const bracket = bracketResponse.body;

  const teamAlpha = await prisma.team.create({ data: { name: 'Team Alpha' } });
  const teamBravo = await prisma.team.create({ data: { name: 'Team Bravo' } });
  const teamCharlie = await prisma.team.create({ data: { name: 'Team Charlie' } });
  const teamDelta = await prisma.team.create({ data: { name: 'Team Delta' } });

  await prisma.registration.createMany({
    data: [
      { divisionId: division.id, teamId: teamAlpha.id, entryCode: 'ALPHA_001' },
      { divisionId: division.id, teamId: teamBravo.id, entryCode: 'BRAVO_002' },
      { divisionId: division.id, teamId: teamCharlie.id, entryCode: 'CHARLIE_003' },
      { divisionId: division.id, teamId: teamDelta.id, entryCode: 'DELTA_004' },
    ],
  });

  const matchOne = await prisma.match.create({
    data: {
      bracketId: bracket.id,
      team1Id: teamAlpha.id,
      team2Id: teamBravo.id,
    },
  });

  const matchTwo = await prisma.match.create({
    data: {
      bracketId: bracket.id,
      team1Id: teamCharlie.id,
      team2Id: teamDelta.id,
    },
  });

  return {
    headers,
    tournament,
    division,
    bracket,
    courts: tournament.courts,
    matchOne,
    matchTwo,
  };
}

describe('Scheduling routes', () => {
  test('returns courts and queued matches for a bracket', async () => {
    const { tournament, bracket, headers } = await bootstrapSchedulingFixture('schedule-list');

    const response = await request(app)
      .get(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/schedule`)
      .set(headers);

    expect(response.statusCode).toBe(200);
    expect(response.body.courts).toHaveLength(2);
    expect(response.body.queue).toHaveLength(2);
    expect(response.body.queue[0]).toHaveProperty('team1');
    expect(response.body.queue[0]).toHaveProperty('team2');
    expect(Array.isArray(response.body.queue[0].conflicts)).toBe(true);
    expect(response.body.queuePaused).toBe(false);
    expect(response.body.queue[0]).toHaveProperty('status');
  });

  test('assigns and unassigns a match to a court', async () => {
    const { tournament, bracket, headers, courts, matchOne } = await bootstrapSchedulingFixture('schedule-assign');

    const assignResponse = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/${matchOne.id}/assignment`)
      .set(headers)
      .send({ courtId: courts[0].id });

    expect(assignResponse.statusCode).toBe(200);
    expect(assignResponse.body.courtId).toBe(courts[0].id);
    expect(Array.isArray(assignResponse.body.conflicts)).toBe(true);
    expect(assignResponse.body.status).toBe('ACTIVE');

    const scheduleAfterAssign = await request(app)
      .get(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/schedule`)
      .set(headers);

    expect(scheduleAfterAssign.body.courts[0].assignment?.id).toBe(matchOne.id);
    expect(scheduleAfterAssign.body.queue).toHaveLength(1);

    const unassignResponse = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/${matchOne.id}/assignment`)
      .set(headers)
      .send({ courtId: null });

    expect(unassignResponse.statusCode).toBe(200);
    expect(unassignResponse.body.courtId).toBeNull();
    expect(Array.isArray(unassignResponse.body.conflicts)).toBe(true);
    expect(unassignResponse.body.status).toBe('PENDING');

    const scheduleAfterUnassign = await request(app)
      .get(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/schedule`)
      .set(headers);

    expect(scheduleAfterUnassign.body.courts[0].assignment).toBeNull();
    expect(scheduleAfterUnassign.body.queue).toHaveLength(2);
  });

  test('prevents assigning two matches to the same court', async () => {
    const { tournament, bracket, headers, courts, matchOne, matchTwo } =
      await bootstrapSchedulingFixture('schedule-conflict');

    const firstAssign = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/${matchOne.id}/assignment`)
      .set(headers)
      .send({ courtId: courts[0].id });

    expect(firstAssign.statusCode).toBe(200);

    const conflictingAssign = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/${matchTwo.id}/assignment`)
      .set(headers)
      .send({ courtId: courts[0].id });

    expect(conflictingAssign.statusCode).toBe(409);
    expect(conflictingAssign.body.error).toMatch(/Court is already assigned/);
  });

  test('detects conflicts when a team would play on multiple courts', async () => {
    const { tournament, bracket, division, headers, courts, matchOne } =
      await bootstrapSchedulingFixture('schedule-team-conflict');

    const teamEcho = await prisma.team.create({ data: { name: 'Team Echo' } });
    const registrationData = {
      divisionId: division.id,
      teamId: teamEcho.id,
      entryCode: 'ECHO_005',
    };
    await prisma.registration.create({ data: registrationData });

    const conflictingMatch = await prisma.match.create({
      data: {
        bracketId: bracket.id,
        team1Id: matchOne.team1Id,
        team2Id: teamEcho.id,
      },
    });

    const firstAssign = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/${matchOne.id}/assignment`)
      .set(headers)
      .send({ courtId: courts[0].id });

    expect(firstAssign.statusCode).toBe(200);

    const conflictAttempt = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/${conflictingMatch.id}/assignment`)
      .set(headers)
      .send({ courtId: courts[1]?.id ?? courts[0].id });

    expect(conflictAttempt.statusCode).toBe(409);
    expect(conflictAttempt.body.error).toMatch(/Conflict/);

    const schedule = await request(app)
      .get(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/schedule`)
      .set(headers);

    const queued = schedule.body.queue.find((match) => match.id === conflictingMatch.id);
    expect(queued).toBeDefined();
    expect(queued.conflicts.length).toBeGreaterThan(0);
    expect(queued.conflicts[0].type).toBe('TEAM');
    expect(queued.conflicts[0].opponents.length).toBeGreaterThan(0);
  });

  test('reschedules matches via bulk endpoint', async () => {
    const { tournament, bracket, headers, matchOne } = await bootstrapSchedulingFixture('schedule-reschedule');

    const future = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const rescheduleResponse = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/schedule/reschedule`)
      .set(headers)
      .send({
        updates: [
          {
            matchId: matchOne.id,
            startTime: future,
            priority: 5,
          },
        ],
      });

    expect(rescheduleResponse.statusCode).toBe(200);
    expect(rescheduleResponse.body.matches).toHaveLength(1);
    expect(rescheduleResponse.body.matches[0].startTime).toBe(future);
    expect(rescheduleResponse.body.matches[0].priority).toBe(5);
  });

  test('retires matches and removes them from the queue', async () => {
    const { tournament, bracket, headers, matchOne } = await bootstrapSchedulingFixture('schedule-retire');

    const retireResponse = await request(app)
      .post(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/retire`)
      .set(headers)
      .send({ matchIds: [matchOne.id] });

    expect(retireResponse.statusCode).toBe(200);
    expect(retireResponse.body.matches[0].status).toBe('RETIRED');

    const scheduleAfterRetire = await request(app)
      .get(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/schedule`)
      .set(headers);

    expect(scheduleAfterRetire.body.queue.find((match) => match.id === matchOne.id)).toBeUndefined();
  });

  test('swaps matches between courts', async () => {
    const { tournament, bracket, headers, courts, matchOne, matchTwo } =
      await bootstrapSchedulingFixture('schedule-swap');

    await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/${matchOne.id}/assignment`)
      .set(headers)
      .send({ courtId: courts[0].id });

    await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/${matchTwo.id}/assignment`)
      .set(headers)
      .send({ courtId: courts[1].id });

    const swapResponse = await request(app)
      .post(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/matches/swap`)
      .set(headers)
      .send({ matchAId: matchOne.id, matchBId: matchTwo.id });

    expect(swapResponse.statusCode).toBe(200);
    expect(swapResponse.body.matches).toHaveLength(2);

    const scheduleAfterSwap = await request(app)
      .get(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/schedule`)
      .set(headers);

    const courtAssignments = scheduleAfterSwap.body.courts.reduce((acc, court) => {
      if (court.assignment) {
        acc[court.assignment.id] = court.id;
      }
      return acc;
    }, {});

    expect(courtAssignments[matchOne.id]).toBe(courts[1].id);
    expect(courtAssignments[matchTwo.id]).toBe(courts[0].id);
  });

  test('pauses and resumes the queue', async () => {
    const { tournament, bracket, headers } = await bootstrapSchedulingFixture('schedule-pause');

    const pauseResponse = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/queue`)
      .set(headers)
      .send({ paused: true });

    expect(pauseResponse.statusCode).toBe(200);
    expect(pauseResponse.body.queuePaused).toBe(true);

    const resumeResponse = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/queue`)
      .set(headers)
      .send({ paused: false });

    expect(resumeResponse.statusCode).toBe(200);
    expect(resumeResponse.body.queuePaused).toBe(false);
  });

  test('reorders queue priorities', async () => {
    const { tournament, bracket, headers, matchOne, matchTwo } = await bootstrapSchedulingFixture('schedule-reorder');

    const reorderResponse = await request(app)
      .patch(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/queue/reorder`)
      .set(headers)
      .send({ order: [matchTwo.id, matchOne.id] });

    expect(reorderResponse.statusCode).toBe(200);
    expect(reorderResponse.body.matches).toHaveLength(2);

    const scheduleAfterReorder = await request(app)
      .get(`/api/v1/tournaments/${tournament.slug}/brackets/${bracket.id}/schedule`)
      .set(headers);

    const queueIds = scheduleAfterReorder.body.queue.map((match) => match.id);
    expect(queueIds.slice(0, 2)).toEqual([matchTwo.id, matchOne.id]);
    expect(scheduleAfterReorder.body.queue[0].priority).toBeGreaterThan(
      scheduleAfterReorder.body.queue[1].priority,
    );
  });

  test('returns tournament queue overview', async () => {
    const { tournament, headers } = await bootstrapSchedulingFixture('schedule-overview');

    const response = await request(app)
      .get(`/api/v1/tournaments/${tournament.slug}/queue`)
      .set(headers);

    expect(response.statusCode).toBe(200);
    expect(response.body.slug).toBe(tournament.slug);
    expect(response.body.tournamentName).toBeTruthy();
    expect(Array.isArray(response.body.queues)).toBe(true);
    expect(response.body.queues.length).toBeGreaterThan(0);
    expect(Array.isArray(response.body.globalQueue)).toBe(true);
    expect(response.body.globalQueue.length).toBeGreaterThan(0);
  });
});
