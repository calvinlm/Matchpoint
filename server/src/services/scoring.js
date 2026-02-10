const prisma = require('../lib/prisma');
const { recordAuditLog } = require('./audit');
const {
  setMatchStatusOverride,
  clearMatchStatusOverride,
  clearQueuePriorityOverride,
} = require('./scheduling');
const { recalculateBracketStandings } = require('./standings');

function determineLoserId({ match, winnerId }) {
  if (!match.team1Id || !match.team2Id) {
    return null;
  }

  if (winnerId === match.team1Id) {
    return match.team2Id;
  }

  if (winnerId === match.team2Id) {
    return match.team1Id;
  }

  return null;
}

function ensureGamesArray(games) {
  if (!Array.isArray(games) || games.length === 0) {
    throw Object.assign(new Error('games must be a non-empty array'), { status: 400 });
  }

  return games.map((game, index) => {
    if (!game || typeof game !== 'object') {
      throw Object.assign(new Error(`games[${index}] must be an object with team1 and team2 scores`), { status: 400 });
    }

    const team1 = Number(game.team1);
    const team2 = Number(game.team2);

    if (!Number.isInteger(team1) || team1 < 0) {
      throw Object.assign(new Error(`games[${index}].team1 must be a non-negative integer`), { status: 400 });
    }

    if (!Number.isInteger(team2) || team2 < 0) {
      throw Object.assign(new Error(`games[${index}].team2 must be a non-negative integer`), { status: 400 });
    }

    return { team1, team2 };
  });
}

function evaluateGames(games, { bestOf, winBy2 }) {
  const requiredWins = Math.ceil(bestOf / 2);

  if (!Number.isInteger(bestOf) || bestOf <= 0) {
    throw Object.assign(new Error('Bracket config is missing a valid bestOf setting'), { status: 500 });
  }

  let team1Wins = 0;
  let team2Wins = 0;

  games.forEach((game, index) => {
    if (game.team1 === game.team2) {
      throw Object.assign(new Error(`games[${index}] cannot be a tie`), { status: 400 });
    }

    const diff = Math.abs(game.team1 - game.team2);
    if (winBy2 && diff < 2) {
      throw Object.assign(new Error(`games[${index}] must be won by at least 2 points`), { status: 400 });
    }

    if (game.team1 > game.team2) {
      team1Wins += 1;
    } else {
      team2Wins += 1;
    }

    const remainingGames = games.length - index - 1;
    if ((team1Wins >= requiredWins || team2Wins >= requiredWins) && remainingGames > 0) {
      throw Object.assign(
        new Error('Score includes games after a winner was already determined'),
        { status: 400 },
      );
    }
  });

  if (games.length > bestOf) {
    throw Object.assign(
      new Error(`Number of games (${games.length}) cannot exceed best-of limit (${bestOf})`),
      { status: 400 },
    );
  }

  if (team1Wins < requiredWins && team2Wins < requiredWins) {
    throw Object.assign(new Error('Submitted games do not produce a winner'), { status: 400 });
  }

  const winnerKey = team1Wins > team2Wins ? 'team1' : 'team2';

  return {
    winnerKey,
    team1Wins,
    team2Wins,
    requiredWins,
  };
}

async function applyMatchAdvancements({ tx, match, winnerId, actor }) {
  const loserId = determineLoserId({ match, winnerId });

  const advancements = await tx.matchAdvancement.findMany({
    where: { fromMatchId: match.id },
    include: {
      toMatch: {
        select: {
          id: true,
          team1Id: true,
          team2Id: true,
        },
      },
    },
  });

  const updates = [];

  for (const advancement of advancements) {
    const targetTeamId = advancement.placement === 'WINNER' ? winnerId : loserId;
    if (!targetTeamId) {
      continue;
    }

    const slotField = advancement.slot === 2 ? 'team2Id' : 'team1Id';
    const currentTeamId = advancement.toMatch?.[slotField];

    if (currentTeamId && currentTeamId !== targetTeamId) {
      throw Object.assign(
        new Error(
          `Match ${advancement.toMatchId} already has a different team assigned to slot ${advancement.slot}`,
        ),
        { status: 409 },
      );
    }

    if (currentTeamId === targetTeamId) {
      updates.push({
        matchId: advancement.toMatchId,
        placement: advancement.placement,
        slot: advancement.slot,
        teamId: targetTeamId,
        updated: false,
      });
      continue;
    }

    const updatedMatch = await tx.match.update({
      where: { id: advancement.toMatchId },
      data: { [slotField]: targetTeamId },
      include: {
        bracket: {
          select: {
            id: true,
            divisionId: true,
          },
        },
      },
    });

    await recordAuditLog(
      {
        actor,
        action: advancement.placement === 'WINNER' ? 'MATCH_ADVANCE_WINNER' : 'MATCH_ADVANCE_LOSER',
        resourceType: 'Match',
        resourceId: advancement.toMatchId,
        metadata: {
          fromMatchId: match.id,
          placement: advancement.placement,
          slot: advancement.slot,
          assignedTeamId: targetTeamId,
        },
      },
      tx,
    );

    updates.push({
      matchId: updatedMatch.id,
      placement: advancement.placement,
      slot: advancement.slot,
      teamId: targetTeamId,
      updated: true,
    });
  }

  return updates;
}

async function submitMatchScore({ slug, bracketId, matchId, games, actor }) {
  if (!matchId || typeof matchId !== 'string') {
    throw Object.assign(new Error('matchId is required'), { status: 400 });
  }

  const sanitizedGames = ensureGamesArray(games);

  const match = await prisma.match.findFirst({
    where: {
      id: matchId,
      bracketId,
      bracket: {
        division: {
          tournament: {
            slug,
          },
        },
      },
    },
    include: {
      team1: true,
      team2: true,
      bracket: {
        select: {
          id: true,
          config: true,
          divisionId: true,
        },
      },
    },
  });

  if (!match) {
    throw Object.assign(new Error(`Match ${matchId} not found for bracket ${bracketId}`), { status: 404 });
  }

  if (!match.team1Id || !match.team2Id) {
    throw Object.assign(new Error('Both teams must be assigned before recording a score'), { status: 409 });
  }

  if (match.winnerId) {
    throw Object.assign(new Error('Match has already been completed'), { status: 409 });
  }

  const { config } = match.bracket;

  if (!config || typeof config !== 'object') {
    throw Object.assign(new Error('Bracket config missing for scoring'), { status: 500 });
  }

  const evaluation = evaluateGames(sanitizedGames, {
    bestOf: Number(config.bestOf ?? 0),
    winBy2: Boolean(config.winBy2),
  });

  const winnerId = evaluation.winnerKey === 'team1' ? match.team1Id : match.team2Id;
  if (!winnerId) {
    throw Object.assign(new Error('Unable to determine winner from submitted scores'), { status: 500 });
  }

  const completedAt = new Date();

  const { result: updated, advancements } = await prisma.$transaction(async (tx) => {
    const result = await tx.match.update({
      where: { id: match.id },
      data: {
        winnerId,
        courtId: null,
        startTime: match.startTime ?? completedAt,
        score: {
          games: sanitizedGames,
          bestOf: Number(config.bestOf ?? sanitizedGames.length),
          winBy2: Boolean(config.winBy2),
          completedAt: completedAt.toISOString(),
        },
      },
      include: {
        bracket: {
          select: {
            id: true,
            divisionId: true,
          },
        },
      },
    });

    await recordAuditLog(
      {
        actor,
        action: 'MATCH_SCORE_SUBMIT',
        resourceType: 'Match',
        resourceId: result.id,
        metadata: {
          bracketId: result.bracketId,
          divisionId: result.bracket.divisionId,
          games: sanitizedGames,
          winnerId,
        },
      },
      tx,
    );

    const advancementUpdates = await applyMatchAdvancements({
      tx,
      match,
      winnerId,
      actor,
    });

    await recalculateBracketStandings({
      bracketId: match.bracketId,
      tx,
    });

    return { result, advancements: advancementUpdates };
  });

  clearQueuePriorityOverride(updated.id);
  setMatchStatusOverride(updated.id, 'COMPLETED');

  advancements
    .filter((entry) => entry.updated)
    .forEach((entry) => {
      clearQueuePriorityOverride(entry.matchId);
      clearMatchStatusOverride(entry.matchId);
      setMatchStatusOverride(entry.matchId, 'PENDING');
    });

  return {
    id: updated.id,
    bracketId: updated.bracketId,
    divisionId: updated.bracket.divisionId,
    winnerId,
    status: 'COMPLETED',
    score: {
      games: sanitizedGames,
      bestOf: Number(config.bestOf ?? sanitizedGames.length),
      winBy2: Boolean(config.winBy2),
      completedAt: completedAt.toISOString(),
    },
  };
}

module.exports = {
  submitMatchScore,
};
