function normalizeAgeGroup(ageGroup) {
  if (!ageGroup) return '';
  if (ageGroup.startsWith('A') && ageGroup.length > 1) {
    return ageGroup.slice(1);
  }
  if (ageGroup === 'JUNIOR') {
    return 'JR';
  }
  return ageGroup;
}

function normalizeDivisionName(name) {
  if (!name) return '';
  const cleaned = name.replace(/['’]s\b/gi, '');
  return cleaned
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase())
    .join('');
}

function normalizeLevel(level) {
  if (!level) return '';
  const lower = level.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function buildEntryCodePrefix(division) {
  const age = normalizeAgeGroup(division.ageGroup);
  const divisionPart = normalizeDivisionName(division.name);
  const level = normalizeLevel(division.level);
  return `${age}${divisionPart}${level}`;
}

function parseExistingSequence(entryCode) {
  if (!entryCode) return 0;
  const match = entryCode.match(/_(\d+)$/);
  if (!match) return 0;
  return Number.parseInt(match[1], 10) || 0;
}

function assignEntryCodes(registrations, divisionMeta, existingSequenceMap = new Map()) {
  const counters = new Map();

  return registrations.map((registration) => {
    const division = divisionMeta.get(registration.divisionId);
    if (!division) {
      throw new Error(`Missing division metadata for ${registration.divisionId}`);
    }

    const prefix = buildEntryCodePrefix(division);
    const startSequence = existingSequenceMap.get(division.id) ?? 1;
    const next = counters.get(division.id) ?? startSequence;
    counters.set(division.id, next + 1);

    const entryCode = `${prefix}_${String(next).padStart(3, '0')}`;

    return {
      ...registration,
      entryCode,
    };
  });
}

module.exports = {
  assignEntryCodes,
  buildEntryCodePrefix,
  normalizeAgeGroup,
  normalizeDivisionName,
  normalizeLevel,
  parseExistingSequence,
};
