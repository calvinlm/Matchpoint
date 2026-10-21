const { validateBracketConfig } = require('../../src/config/bracketConfigValidation');

describe('validateBracketConfig', () => {
  test('round robin fills defaults', () => {
    expect(validateBracketConfig('ROUND_ROBIN', {})).toEqual({
      bestOf: 1,
      winBy2: true,
      groups: 1,
      groupSize: 4,
    });
  });

  test('round robin keeps provided group settings', () => {
    expect(validateBracketConfig('ROUND_ROBIN', { bestOf: 3, winBy2: false, groups: 2, groupSize: 3 })).toEqual({
      bestOf: 3,
      winBy2: false,
      groups: 2,
      groupSize: 3,
    });
  });

  test('elimination requires rounds', () => {
    expect(() => validateBracketConfig('SINGLE_ELIMINATION', {})).toThrow('config.rounds');
  });

  test('elimination names unnamed rounds', () => {
    const config = validateBracketConfig('SINGLE_ELIMINATION', { rounds: [{ matchCount: 2 }, { name: 'Final', matchCount: 1 }] });
    expect(config.rounds).toEqual([
      { name: 'Round 1', matchCount: 2 },
      { name: 'Final', matchCount: 1 },
    ]);
  });

  test.each([
    ['ROUND_ROBIN', { bestOf: 0 }, 'config.bestOf'],
    ['ROUND_ROBIN', { winBy2: 'yes' }, 'config.winBy2'],
    ['ROUND_ROBIN', { groups: -1 }, 'config.groups'],
    ['LADDER', {}, 'Unsupported bracket type'],
  ])('%s %j is rejected', (type, config, message) => {
    expect(() => validateBracketConfig(type, config)).toThrow(message);
  });
});
