// Seeds "QA Test Open 2026": 2 courts, one Open division, 6 teams, a seeded round robin.
// Runs every step through the API in-process, the same way the director console does,
// so it doubles as a smoke test. Re-running it deletes the previous QA data first.
//
//   npm run seed:qa
//
// Refuses to run when NODE_ENV=production.
require('dotenv/config');
const request = require('supertest');

const SLUG = 'qa-test-open-2026';
const TEAM_PREFIX = 'QA Team ';
const PLAYER_LAST_NAME = 'QA';
const TEAMS = ['A', 'B', 'C', 'D', 'E', 'F'];

function fail(message, response) {
  const detail = response ? ` (${response.status}: ${JSON.stringify(response.body)})` : '';
  throw new Error(`${message}${detail}`);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed:qa refuses to run with NODE_ENV=production');
  }

  const app = require('../app');
  const prisma = require('../src/lib/prisma');
  const { issueToken } = require('../src/services/auth');

  const token = issueToken({ id: 'qa-seed', email: 'qa-seed@matchpoint.local', role: 'ADMIN' });
  const api = (method, url) => request(app)[method](url).set('Authorization', `Bearer ${token}`);

  try {
    // Reset: the tournament cascades to divisions, brackets, matches and registrations.
    // Teams and players are global, so remove the ones this script created.
    await prisma.tournament.deleteMany({ where: { slug: SLUG } });
    await prisma.team.deleteMany({ where: { name: { startsWith: TEAM_PREFIX } } });
    await prisma.player.deleteMany({ where: { lastName: PLAYER_LAST_NAME } });

    const tournament = await api('post', '/api/v1/tournaments').send({
      name: 'QA Test Open 2026',
      slug: SLUG,
      plannedCourtCount: 2,
      location: 'QA',
    });
    if (tournament.status !== 201) fail('Create tournament failed', tournament);

    const division = await api('post', `/api/v1/tournaments/${SLUG}/divisions`).send({
      name: 'Open Doubles',
      level: 'OPN',
      ageGroup: 'A18',
      format: 'DOUBLES',
    });
    if (division.status !== 201) fail('Create division failed', division);
    const divisionId = division.body.id ?? division.body.division?.id;
    if (!divisionId) fail('Create division returned no id', division);

    const teamIds = [];
    for (const letter of TEAMS) {
      const registration = await api('post', `/api/v1/tournaments/${SLUG}/divisions/${divisionId}/registrations`).send({
        team: { name: `${TEAM_PREFIX}${letter}` },
        players: [
          { firstName: `Player ${letter}1`, lastName: PLAYER_LAST_NAME },
          { firstName: `Player ${letter}2`, lastName: PLAYER_LAST_NAME },
        ],
      });
      if (registration.status !== 201) fail(`Register team ${letter} failed`, registration);
      const teamId = registration.body.teamId ?? registration.body.team?.id ?? registration.body.registration?.teamId;
      if (!teamId) fail(`Register team ${letter} returned no team id`, registration);
      teamIds.push(teamId);
    }

    const bracket = await api('post', `/api/v1/tournaments/${SLUG}/divisions/${divisionId}/brackets`).send({
      type: 'ROUND_ROBIN',
      config: { bestOf: 1, winBy2: true, groups: 1, groupSize: TEAMS.length },
    });
    if (bracket.status !== 201) fail('Create bracket failed', bracket);

    const seeding = await api('patch', `/api/v1/tournaments/${SLUG}/brackets/${bracket.body.id}/seeding`).send({
      entries: teamIds.map((teamId, index) => ({ teamId, seed: index + 1 })),
    });
    if (seeding.status !== 200) fail('Apply seeding failed', seeding);

    const matchCount = await prisma.match.count({ where: { bracketId: bracket.body.id } });
    console.log(`Seeded "QA Test Open 2026" (/td/${SLUG}): 2 courts, ${TEAMS.length} teams, ${matchCount} round-robin matches.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
