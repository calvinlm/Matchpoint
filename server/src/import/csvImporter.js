const Papa = require('papaparse');

const REQUIRED_COLUMNS = [
  'divisionName',
  'divisionFormat',
  'divisionLevel',
  'divisionAgeGroup',
  'teamName',
  'player1First',
  'player1Last',
  'player1DOB',
  'player2First',
  'player2Last',
  'player2DOB',
  'seedNote',
];

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDob(value) {
  const trimmed = normalizeString(value);
  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function buildPlayerKey(firstName, lastName, dob) {
  return `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${dob ?? ''}`;
}

function buildTeamKey(playerKeys) {
  const normalized = [...playerKeys].sort();
  return normalized.join('::');
}

function buildDivisionKey({ name, level, ageGroup, format }) {
  return `${name.toLowerCase()}|${level}|${ageGroup}|${format}`;
}

function validateHeaders(headers) {
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    throw new Error(`Missing required CSV columns: ${missing.join(', ')}`);
  }
}

function parseCsv(csvString) {
  const result = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length > 0) {
    const preview = result.errors
      .map((error) => `${error.type} (row ${error.row ?? 'n/a'}): ${error.message}`)
      .slice(0, 3)
      .join('; ');
    throw new Error(`CSV parsing failed: ${preview}`);
  }

  if (!result.meta.fields) {
    throw new Error('CSV parsing failed: missing header row');
  }

  validateHeaders(result.meta.fields);
  return result.data;
}

function parseConsolidatedCsv(csvString) {
  const rows = parseCsv(csvString);

  const players = [];
  const playersByKey = new Map();

  const teams = [];
  const teamsByKey = new Map();

  const divisions = [];
  const divisionsByKey = new Map();

  const registrations = [];
  const registrationsByKey = new Map();

  const rowErrors = [];

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 2; // account for header row
    const row = Object.fromEntries(
      Object.entries(rawRow).map(([key, value]) => [key, normalizeString(value)]),
    );

    const divisionKey = buildDivisionKey({
      name: row.divisionName,
      level: row.divisionLevel,
      ageGroup: row.divisionAgeGroup,
      format: row.divisionFormat,
    });

    if (!divisionsByKey.has(divisionKey)) {
      const division = {
        id: `division_${divisions.length + 1}`,
        name: row.divisionName,
        level: row.divisionLevel,
        ageGroup: row.divisionAgeGroup,
        format: row.divisionFormat,
      };
      divisionsByKey.set(divisionKey, division);
      divisions.push(division);
    }

    const playerEntries = [
      {
        firstName: row.player1First,
        lastName: row.player1Last,
        dob: normalizeDob(rawRow.player1DOB),
      },
      {
        firstName: row.player2First,
        lastName: row.player2Last,
        dob: normalizeDob(rawRow.player2DOB),
      },
    ].filter((player) => player.firstName || player.lastName);

    if (playerEntries.length === 0) {
      rowErrors.push({
        row: rowNumber,
        message: 'Row must contain at least one player',
      });
      return;
    }

    const playerIds = playerEntries.map((player) => {
      const key = buildPlayerKey(player.firstName, player.lastName, player.dob);
      if (!playersByKey.has(key)) {
        const playerRecord = {
          id: `player_${players.length + 1}`,
          firstName: player.firstName,
          lastName: player.lastName,
          dateOfBirth: player.dob,
        };
        playersByKey.set(key, playerRecord);
        players.push(playerRecord);
      }
      return playersByKey.get(key).id;
    });

    const teamKey = buildTeamKey(playerIds);
    if (!teamsByKey.has(teamKey)) {
      const team = {
        id: `team_${teams.length + 1}`,
        name: row.teamName || playerEntries.map((p) => `${p.firstName} ${p.lastName}`.trim()).join(' / '),
        playerIds,
      };
      teamsByKey.set(teamKey, team);
      teams.push(team);
    }

    const teamId = teamsByKey.get(teamKey).id;
    const divisionId = divisionsByKey.get(divisionKey).id;
    const registrationKey = `${teamId}|${divisionId}`;

    if (!registrationsByKey.has(registrationKey)) {
      const registration = {
        id: `registration_${registrations.length + 1}`,
        teamId,
        divisionId,
        seedNote: row.seedNote || null,
      };
      registrationsByKey.set(registrationKey, registration);
      registrations.push(registration);
    }
  });

  return {
    players,
    teams,
    divisions,
    registrations,
    errors: rowErrors,
  };
}

module.exports = {
  parseConsolidatedCsv,
  parseCsv,
  normalizeDob,
  normalizeString,
  buildPlayerKey,
  buildTeamKey,
  REQUIRED_COLUMNS,
};
