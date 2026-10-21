const { ensureGamesArray, evaluateGames } = require('../../src/services/scoring');

const bestOf3 = { bestOf: 3, winBy2: true };

describe('ensureGamesArray', () => {
  test('accepts numeric strings and returns integers', () => {
    expect(ensureGamesArray([{ team1: '11', team2: '9' }])).toEqual([{ team1: 11, team2: 9 }]);
  });

  test.each([
    [[], 'non-empty array'],
    [null, 'non-empty array'],
    [[{ team1: -1, team2: 11 }], 'non-negative integer'],
    [[{ team1: 11.5, team2: 9 }], 'non-negative integer'],
    [['11-9'], 'must be an object'],
  ])('rejects %j', (games, message) => {
    expect(() => ensureGamesArray(games)).toThrow(message);
  });
});

describe('evaluateGames', () => {
  test('a single game decides a best-of-1 match', () => {
    expect(evaluateGames([{ team1: 11, team2: 7 }], { bestOf: 1, winBy2: true })).toMatchObject({
      winnerKey: 'team1',
      team1Wins: 1,
      team2Wins: 0,
    });
  });

  test('best of 3 won 2–1 by team 2', () => {
    const games = [
      { team1: 11, team2: 8 },
      { team1: 9, team2: 11 },
      { team1: 10, team2: 12 },
    ];
    expect(evaluateGames(games, bestOf3)).toMatchObject({ winnerKey: 'team2', team1Wins: 1, team2Wins: 2 });
  });

  test('rejects a tie', () => {
    expect(() => evaluateGames([{ team1: 11, team2: 11 }], bestOf3)).toThrow('cannot be a tie');
  });

  test('rejects a 1-point margin when win-by-2 is on', () => {
    expect(() => evaluateGames([{ team1: 11, team2: 10 }], { bestOf: 1, winBy2: true })).toThrow('won by at least 2');
  });

  test('accepts a 1-point margin when win-by-2 is off', () => {
    expect(evaluateGames([{ team1: 11, team2: 10 }], { bestOf: 1, winBy2: false }).winnerKey).toBe('team1');
  });

  test('rejects games played after the match was decided', () => {
    const games = [
      { team1: 11, team2: 5 },
      { team1: 11, team2: 6 },
      { team1: 3, team2: 11 },
    ];
    expect(() => evaluateGames(games, bestOf3)).toThrow('after a winner was already determined');
  });

  test('rejects scores that do not produce a winner', () => {
    expect(() => evaluateGames([{ team1: 11, team2: 5 }], bestOf3)).toThrow('do not produce a winner');
  });

  // Known gap (audit B8): there is no points-to-win check yet, so 3–1 counts as a finished game.
  // Flip this test when points-to-win validation lands in Phase 1.
  test('currently accepts a game that never reached 11 (B8)', () => {
    expect(evaluateGames([{ team1: 3, team2: 1 }], { bestOf: 1, winBy2: true }).winnerKey).toBe('team1');
  });
});
