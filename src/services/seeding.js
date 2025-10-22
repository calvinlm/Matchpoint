const prisma = require('../lib/prisma');
const { recordAuditLog } = require('../services/audit');
const { regenerateBracketMatches } = require('./matchGeneration');

async function applySeeding({ bracketId, entries, actor }) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('entries must be a non-empty array of { teamId, seed }');
  }

  const seenSeeds = new Set();
  const normalized = entries.map((entry, index) => {
    if (typeof entry !== 'object' || entry == null) {
      throw new Error(`entries[${index}] must be an object`);
    }

    const { teamId, seed } = entry;

    if (!teamId || typeof teamId !== 'string') {
      throw new Error(`entries[${index}].teamId is required`);
    }

    if (!Number.isInteger(seed) || seed <= 0) {
      throw new Error(`entries[${index}].seed must be a positive integer`);
    }

    if (seenSeeds.has(seed)) {
      throw new Error(`Duplicate seed value ${seed} detected`);
    }

    seenSeeds.add(seed);

    return {
      teamId,
      seed,
    };
  });

  const bracket = await prisma.bracket.findUnique({
    where: { id: bracketId },
    include: {
      division: {
        include: {
          tournament: true,
        },
      },
    },
  });

  if (!bracket) {
    throw Object.assign(new Error(`Bracket ${bracketId} not found`), { status: 404 });
  }

  if (bracket.locked) {
    throw Object.assign(new Error('Bracket is locked and cannot be reseeded'), { status: 409 });
  }

  const uniqueTeamIds = [...new Set(normalized.map((entry) => entry.teamId))];

  const registrations = await prisma.registration.findMany({
    where: {
      divisionId: bracket.divisionId,
      teamId: { in: uniqueTeamIds },
    },
    select: {
      teamId: true,
    },
  });

  if (registrations.length !== uniqueTeamIds.length) {
    throw Object.assign(new Error('All teams must be registered in the bracket division'), { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.bracketSeeding.deleteMany({ where: { bracketId } });

    await tx.bracketSeeding.createMany({
      data: normalized.map((entry) => ({
        bracketId,
        teamId: entry.teamId,
        seed: entry.seed,
      })),
      skipDuplicates: true,
    });

    const generation = await regenerateBracketMatches({
      tx,
      bracketId,
      entries: normalized,
    });

    await recordAuditLog({
      actor,
      action: 'BRACKET_SEEDING_APPLY',
      resourceType: 'Bracket',
      resourceId: bracketId,
      metadata: {
        entries: normalized,
        generation,
      },
    }, tx);

    return generation;
  });

  return {
    bracketId,
    entries: normalized,
    generation: result,
  };
}

module.exports = {
  applySeeding,
};
