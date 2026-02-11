const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@prisma/client') {
    return {
      Prisma: {
        Decimal: class Decimal {
          constructor(value) {
            this.value = value;
          }

          toString() {
            return String(this.value);
          }
        },
      },
    };
  }

  return originalLoad(request, parent, isMain);
};

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/matchpoint_test';

const prismaPath = path.resolve(__dirname, '../src/lib/prisma.js');
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: {},
};

const { recalculateBracketStandings } = require('../src/services/standings');

test('recalculateBracketStandings computes standings and writes ordered results', async () => {
  const tx = {
    bracket: {
      findUnique: async () => ({
        id: 'bracket-1',
        matches: [
          {
            id: 'm1',
            team1Id: 'team-a',
            team2Id: 'team-b',
            winnerId: 'team-a',
            score: {
              games: [
                { team1: 11, team2: 7 },
                { team1: 11, team2: 8 },
              ],
            },
          },
          {
            id: 'm2',
            team1Id: 'team-a',
            team2Id: 'team-c',
            winnerId: 'team-c',
            score: {
              games: [
                { team1: 8, team2: 11 },
                { team1: 9, team2: 11 },
              ],
            },
          },
          {
            id: 'm3',
            team1Id: 'team-b',
            team2Id: 'team-c',
            winnerId: 'team-c',
            score: {
              games: [
                { team1: 9, team2: 11 },
                { team1: 7, team2: 11 },
              ],
            },
          },
        ],
      }),
    },
    standing: {
      deleteManyCalls: [],
      createManyCalls: [],
      async deleteMany(payload) {
        this.deleteManyCalls.push(payload);
        return { count: 3 };
      },
      async createMany(payload) {
        this.createManyCalls.push(payload);
        return { count: 3 };
      },
    },
  };

  const standings = await recalculateBracketStandings({ bracketId: 'bracket-1', tx });

  assert.equal(standings.length, 3);
  assert.deepEqual(standings.map((entry) => entry.teamId), ['team-c', 'team-a', 'team-b']);

  assert.deepEqual(
    standings.map(({ teamId, wins, losses, rank }) => ({ teamId, wins, losses, rank })),
    [
      { teamId: 'team-c', wins: 2, losses: 0, rank: 1 },
      { teamId: 'team-a', wins: 1, losses: 1, rank: 2 },
      { teamId: 'team-b', wins: 0, losses: 2, rank: 3 },
    ],
  );

  assert.deepEqual(tx.standing.deleteManyCalls, [{ where: { bracketId: 'bracket-1' } }]);
  assert.equal(tx.standing.createManyCalls.length, 1);
  assert.equal(tx.standing.createManyCalls[0].data.length, 3);
  assert.equal(tx.standing.createManyCalls[0].data[0].quotient.toString(), '1.3333');
});

test('recalculateBracketStandings clears standings when no valid matchups exist', async () => {
  const tx = {
    bracket: {
      findUnique: async () => ({
        id: 'bracket-2',
        matches: [{ id: 'm1', team1Id: null, team2Id: 'team-b', winnerId: null, score: null }],
      }),
    },
    standing: {
      deleteManyCalls: [],
      createManyCalls: [],
      async deleteMany(payload) {
        this.deleteManyCalls.push(payload);
        return { count: 2 };
      },
      async createMany(payload) {
        this.createManyCalls.push(payload);
        return { count: 0 };
      },
    },
  };

  const standings = await recalculateBracketStandings({ bracketId: 'bracket-2', tx });

  assert.deepEqual(standings, []);
  assert.deepEqual(tx.standing.deleteManyCalls, [{ where: { bracketId: 'bracket-2' } }]);
  assert.equal(tx.standing.createManyCalls.length, 0);
});

test('recalculateBracketStandings returns 404 when bracket is missing', async () => {
  const tx = {
    bracket: {
      findUnique: async () => null,
    },
    standing: {
      async deleteMany() {
        return { count: 0 };
      },
      async createMany() {
        return { count: 0 };
      },
    },
  };

  await assert.rejects(
    () => recalculateBracketStandings({ bracketId: 'missing-bracket', tx }),
    (error) => error && error.status === 404,
  );
});
