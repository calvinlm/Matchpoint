const Papa = require('papaparse');
const { REQUIRED_COLUMNS } = require('./csvImporter');

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

function ensureString(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function buildTournamentExportRows(divisions = []) {
  const rows = [];

  divisions.forEach((division) => {
    if (!division) {
      return;
    }

    const registrations = Array.isArray(division.registrations) ? division.registrations : [];

    registrations.forEach((registration) => {
      if (!registration) {
        return;
      }

      const team = registration.team ?? null;
      const players = Array.isArray(team?.players) ? team.players : [];
      const playerRecords = players
        .map((teamPlayer) => teamPlayer?.player)
        .filter((player) => Boolean(player));

      const [primary, secondary] = playerRecords;

      rows.push({
        divisionName: ensureString(division.name),
        divisionFormat: ensureString(division.format),
        divisionLevel: ensureString(division.level),
        divisionAgeGroup: ensureString(division.ageGroup),
        teamName: ensureString(team?.name ?? ''),
        player1First: ensureString(primary?.firstName ?? ''),
        player1Last: ensureString(primary?.lastName ?? ''),
        player1DOB: formatDate(primary?.dateOfBirth),
        player2First: ensureString(secondary?.firstName ?? ''),
        player2Last: ensureString(secondary?.lastName ?? ''),
        player2DOB: formatDate(secondary?.dateOfBirth),
        seedNote: ensureString(registration.seedNote ?? ''),
      });
    });
  });

  return rows;
}

function rowsToCsv(rows) {
  const normalizedRows = rows.map((row) => {
    const output = {};

    REQUIRED_COLUMNS.forEach((column) => {
      const value = row[column];
      output[column] = value === undefined || value === null ? '' : value;
    });

    return output;
  });

  return Papa.unparse(
    {
      fields: REQUIRED_COLUMNS,
      data: normalizedRows,
    },
    { newline: '\n' },
  );
}

function buildTournamentExportCsv(divisions = []) {
  const rows = buildTournamentExportRows(divisions);
  return {
    csv: rowsToCsv(rows),
    rowCount: rows.length,
  };
}

module.exports = {
  buildTournamentExportRows,
  rowsToCsv,
  buildTournamentExportCsv,
};
