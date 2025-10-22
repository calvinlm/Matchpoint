const BRACKET_TYPES = {
  SINGLE_ELIMINATION: 'SINGLE_ELIMINATION',
  DOUBLE_ELIMINATION: 'DOUBLE_ELIMINATION',
  ROUND_ROBIN: 'ROUND_ROBIN',
};

function ensureBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw new Error(`${field} must be a boolean`);
  }
  return value;
}

function ensurePositiveInteger(value, field) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return num;
}

function ensureOptionalBoolean(value, field) {
  if (value === undefined) {
    return undefined;
  }
  return ensureBoolean(value, field);
}

function validateCommonSettings(config) {
  if (config == null || typeof config !== 'object') {
    throw new Error('config must be an object');
  }

  const bestOf = ensurePositiveInteger(config.bestOf ?? 1, 'config.bestOf');
  const winBy2 = ensureBoolean(config.winBy2 ?? true, 'config.winBy2');

  return { bestOf, winBy2 };
}

function validateEliminationConfig(type, config) {
  const base = validateCommonSettings(config);

  if (!Array.isArray(config.rounds) || config.rounds.length === 0) {
    throw new Error('config.rounds must be a non-empty array');
  }

  const rounds = config.rounds.map((round, index) => {
    if (typeof round !== 'object' || round == null) {
      throw new Error(`config.rounds[${index}] must be an object`);
    }

    const name = typeof round.name === 'string' && round.name.trim().length > 0
      ? round.name.trim()
      : `Round ${index + 1}`;

    const matchCount = ensurePositiveInteger(round.matchCount ?? 1, `config.rounds[${index}].matchCount`);

    return { name, matchCount };
  });

  const finalsReset =
    type === BRACKET_TYPES.DOUBLE_ELIMINATION
      ? ensureOptionalBoolean(config.finalsReset, 'config.finalsReset') ?? false
      : false;

  return {
    ...base,
    rounds,
    finalsReset,
  };
}

function validateRoundRobinConfig(config) {
  const base = validateCommonSettings(config);
  const groups = ensurePositiveInteger(config.groups ?? 1, 'config.groups');
  const groupSize = ensurePositiveInteger(config.groupSize ?? 4, 'config.groupSize');

  return {
    ...base,
    groups,
    groupSize,
  };
}

function validateBracketConfig(type, config) {
  switch (type) {
    case BRACKET_TYPES.SINGLE_ELIMINATION:
    case BRACKET_TYPES.DOUBLE_ELIMINATION:
      return validateEliminationConfig(type, config);
    case BRACKET_TYPES.ROUND_ROBIN:
      return validateRoundRobinConfig(config);
    default:
      throw new Error(`Unsupported bracket type "${type}"`);
  }
}

module.exports = {
  BRACKET_TYPES,
  validateBracketConfig,
};
