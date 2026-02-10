const prisma = require('../lib/prisma');

function normalizeRounds(rounds) {
  if (!Array.isArray(rounds) || rounds.length === 0) {
    const error = new Error('config.rounds must be a non-empty array for elimination brackets');
    error.status = 400;
    throw error;
  }

  return rounds.map((round, index) => {
    const matchCount = Number(round?.matchCount);
    if (!Number.isInteger(matchCount) || matchCount <= 0) {
      const error = new Error(`config.rounds[${index}].matchCount must be a positive integer`);
      error.status = 400;
      throw error;
    }

    return {
      name: typeof round?.name === 'string' && round.name.trim().length > 0 ? round.name.trim() : `Round ${index + 1}`,
      matchCount,
    };
  });
}

function normalizeRoundRobin(config, entryCount) {
  const groups = Number(config.groups ?? 1);
  const groupSize = Number(config.groupSize ?? entryCount);

  if (!Number.isInteger(groups) || groups <= 0) {
    const error = new Error('config.groups must be a positive integer for round robin brackets');
    error.status = 400;
    throw error;
  }

  if (!Number.isInteger(groupSize) || groupSize <= 1) {
    const error = new Error('config.groupSize must be an integer greater than 1 for round robin brackets');
    error.status = 400;
    throw error;
  }

  if (entryCount > groups * groupSize) {
    const error = new Error(
      `Round robin configuration can host at most ${groups * groupSize} teams but received ${entryCount}`,
    );
    error.status = 400;
    throw error;
  }

  return { groups, groupSize };
}

async function generateSingleElimination({ tx, bracketId, config, entries }) {
  const rounds = normalizeRounds(config.rounds);
  const sortedEntries = [...entries].sort((a, b) => a.seed - b.seed);
  const totalTeams = sortedEntries.length;
  const expectedTeams = rounds[0].matchCount * 2;

  if (totalTeams !== expectedTeams) {
    const error = new Error(
      `Elimination bracket first round expects ${expectedTeams} seeded teams but received ${totalTeams}`,
    );
    error.status = 400;
    throw error;
  }

  const createdRounds = [];

  for (let roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
    const roundDef = rounds[roundIndex];
    const roundMatches = [];

    for (let matchIndex = 0; matchIndex < roundDef.matchCount; matchIndex += 1) {
      const data = {
        bracketId,
      };

      if (roundIndex === 0) {
        const team1Entry = sortedEntries[matchIndex];
        const team2Entry = sortedEntries[sortedEntries.length - 1 - matchIndex];

        data.team1Id = team1Entry?.teamId ?? null;
        data.team2Id = team2Entry?.teamId ?? null;
      }

      const match = await tx.match.create({ data });
      roundMatches.push(match);
    }

    createdRounds.push(roundMatches);
  }

  let advancementCount = 0;
  for (let roundIndex = 0; roundIndex < createdRounds.length - 1; roundIndex += 1) {
    const currentRound = createdRounds[roundIndex];
    const nextRound = createdRounds[roundIndex + 1];

    for (let matchIndex = 0; matchIndex < currentRound.length; matchIndex += 1) {
      const fromMatch = currentRound[matchIndex];
      const targetMatch = nextRound[Math.floor(matchIndex / 2)];
      const slot = (matchIndex % 2) + 1;

      await tx.matchAdvancement.create({
        data: {
          fromMatchId: fromMatch.id,
          toMatchId: targetMatch.id,
          placement: 'WINNER',
          slot,
        },
      });

      advancementCount += 1;
    }
  }

  return {
    matchesCreated: createdRounds.reduce((total, round) => total + round.length, 0),
    advancementsCreated: advancementCount,
  };
}

async function generateRoundRobin({ tx, bracketId, config, entries }) {
  const sortedEntries = [...entries].sort((a, b) => a.seed - b.seed);
  const { groups, groupSize } = normalizeRoundRobin(config, sortedEntries.length);

  let matchCount = 0;

  for (let groupIndex = 0; groupIndex < groups; groupIndex += 1) {
    const start = groupIndex * groupSize;
    const groupEntries = sortedEntries.slice(start, start + groupSize);

    for (let i = 0; i < groupEntries.length; i += 1) {
      for (let j = i + 1; j < groupEntries.length; j += 1) {
        const teamA = groupEntries[i];
        const teamB = groupEntries[j];

        if (!teamA || !teamB) {
          continue;
        }

        await tx.match.create({
          data: {
            bracketId,
            team1Id: teamA.teamId,
            team2Id: teamB.teamId,
          },
        });

        matchCount += 1;
      }
    }
  }

  return {
    matchesCreated: matchCount,
    advancementsCreated: 0,
  };
}

async function regenerateBracketMatches({ tx = prisma, bracketId, entries }) {
  const bracket = await tx.bracket.findUnique({
    where: { id: bracketId },
    select: {
      id: true,
      type: true,
      config: true,
    },
  });

  if (!bracket) {
    const error = new Error(`Bracket ${bracketId} not found`);
    error.status = 404;
    throw error;
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    await tx.match.deleteMany({ where: { bracketId } });
    await tx.standing.deleteMany({ where: { bracketId } });
    return { matchesCreated: 0, advancementsCreated: 0 };
  }

  await tx.match.deleteMany({ where: { bracketId } });
  await tx.standing.deleteMany({ where: { bracketId } });

  switch (bracket.type) {
    case 'SINGLE_ELIMINATION':
    case 'DOUBLE_ELIMINATION':
      return generateSingleElimination({
        tx,
        bracketId: bracket.id,
        config: bracket.config ?? {},
        entries,
      });
    case 'ROUND_ROBIN':
      return generateRoundRobin({
        tx,
        bracketId: bracket.id,
        config: bracket.config ?? {},
        entries,
      });
    default: {
      const error = new Error(`Bracket type ${bracket.type} is not supported for automatic match generation`);
      error.status = 400;
      throw error;
    }
  }
}

module.exports = {
  regenerateBracketMatches,
};
