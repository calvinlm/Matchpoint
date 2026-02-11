const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BRACKET_TYPES,
  validateBracketConfig,
} = require('../src/config/brackets/configValidation');

test('validateBracketConfig normalizes single elimination settings', () => {
  const config = validateBracketConfig(BRACKET_TYPES.SINGLE_ELIMINATION, {
    bestOf: 3,
    winBy2: true,
    rounds: [{ matchCount: 2 }, { name: 'Final', matchCount: 1 }],
  });

  assert.deepEqual(config, {
    bestOf: 3,
    winBy2: true,
    finalsReset: false,
    rounds: [
      { name: 'Round 1', matchCount: 2 },
      { name: 'Final', matchCount: 1 },
    ],
  });
});

test('validateBracketConfig allows optional finalsReset for double elimination', () => {
  const config = validateBracketConfig(BRACKET_TYPES.DOUBLE_ELIMINATION, {
    rounds: [{ name: 'Winners R1', matchCount: 4 }],
    finalsReset: true,
  });

  assert.equal(config.finalsReset, true);
  assert.equal(config.bestOf, 1);
  assert.equal(config.winBy2, true);
});

test('validateBracketConfig validates round robin settings', () => {
  const config = validateBracketConfig(BRACKET_TYPES.ROUND_ROBIN, {
    groups: 2,
    groupSize: 5,
    bestOf: 1,
    winBy2: false,
  });

  assert.deepEqual(config, {
    bestOf: 1,
    winBy2: false,
    groups: 2,
    groupSize: 5,
  });
});

test('validateBracketConfig rejects unsupported type', () => {
  assert.throws(
    () => validateBracketConfig('INVALID', {}),
    /Unsupported bracket type/,
  );
});
