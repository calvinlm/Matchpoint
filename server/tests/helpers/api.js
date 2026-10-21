const request = require('supertest');
const app = require('../../app');
const { issueToken } = require('../../src/services/auth');

const token = issueToken({ id: 'test-director', email: 'td@test.local', role: 'ADMIN' });

// Authenticated request helper: api('post', '/api/v1/tournaments').send({...})
function api(method, url) {
  return request(app)[method](url).set('Authorization', `Bearer ${token}`);
}

// Creates a tournament with one division and `teamCount` registered teams of two players.
async function createTournamentWithTeams({ slug, courts = 2, teamCount = 6 }) {
  const tournament = await api('post', '/api/v1/tournaments').send({ name: `Test ${slug}`, slug, plannedCourtCount: courts });
  expect(tournament.status).toBe(201);

  const division = await api('post', `/api/v1/tournaments/${slug}/divisions`).send({
    name: 'Open Doubles',
    level: 'OPN',
    ageGroup: 'A18',
    format: 'DOUBLES',
  });
  expect(division.status).toBe(201);
  const divisionId = division.body.id ?? division.body.division?.id;

  const teams = [];
  for (let i = 0; i < teamCount; i += 1) {
    const letter = String.fromCharCode(65 + i);
    const registration = await api('post', `/api/v1/tournaments/${slug}/divisions/${divisionId}/registrations`).send({
      team: { name: `Team ${letter}` },
      players: [
        { firstName: `${letter}1`, lastName: 'Test' },
        { firstName: `${letter}2`, lastName: 'Test' },
      ],
    });
    expect(registration.status).toBe(201);
    teams.push({
      id: registration.body.teamId ?? registration.body.team?.id ?? registration.body.registration?.teamId,
      name: `Team ${letter}`,
    });
  }

  return { slug, divisionId, teams };
}

async function createSeededRoundRobin({ slug, divisionId, teams, config = {} }) {
  const bracket = await api('post', `/api/v1/tournaments/${slug}/divisions/${divisionId}/brackets`).send({
    type: 'ROUND_ROBIN',
    config: { bestOf: 1, winBy2: true, groups: 1, groupSize: teams.length, ...config },
  });
  expect(bracket.status).toBe(201);

  const seeding = await api('patch', `/api/v1/tournaments/${slug}/brackets/${bracket.body.id}/seeding`).send({
    entries: teams.map((team, index) => ({ teamId: team.id, seed: index + 1 })),
  });
  expect(seeding.status).toBe(200);

  return bracket.body;
}

module.exports = { api, createTournamentWithTeams, createSeededRoundRobin };
