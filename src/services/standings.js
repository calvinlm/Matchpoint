const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');

function ensureTeamStats(map, teamId) {
  if (!teamId) {
    return null;
  }

  if (!map.has(teamId)) {
    map.set(teamId, {
      teamId,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      quotient: 0,
    });
  }

  return map.get(teamId);
}

function sumTeamPoints(games, key) {
  if (!Array.isArray(games)) {
    return 0;
  }

  return games.reduce((total, game) => {
    if (!game || typeof game !== 'object') {
      return total;
    }

    const value = Number(game[key]);
    if (!Number.isFinite(value) || value < 0) {
      return total;
    }

    return total + value;
  }, 0);
}

function computeQuotient(pointsFor, pointsAgainst) {
  if (pointsFor === 0 && pointsAgainst === 0) {
    return 0;
  }

  if (pointsAgainst === 0) {
    return pointsFor;
  }

  return pointsFor / pointsAgainst;
}

async function recalculateBracketStandings({ bracketId, tx = prisma }) {
  if (!bracketId) {
    throw new Error('bracketId is required to recalculate standings');
  }

  const bracket = await tx.bracket.findUnique({
    where: { id: bracketId },
    select: {
      id: true,
      matches: {
        select: {
          id: true,
          team1Id: true,
          team2Id: true,
          winnerId: true,
          score: true,
        },
      },
    },
  });

  if (!bracket) {
    throw Object.assign(new Error(`Bracket ${bracketId} not found`), { status: 404 });
  }

  const statsMap = new Map();

  bracket.matches.forEach((match) => {
    const { team1Id, team2Id, winnerId, score } = match;
    if (!team1Id || !team2Id) {
      return;
    }

    const games = Array.isArray(score?.games) ? score.games : [];
    const team1Points = sumTeamPoints(games, 'team1');
    const team2Points = sumTeamPoints(games, 'team2');

    const team1Stats = ensureTeamStats(statsMap, team1Id);
    const team2Stats = ensureTeamStats(statsMap, team2Id);

    team1Stats.pointsFor += team1Points;
    team1Stats.pointsAgainst += team2Points;
    team2Stats.pointsFor += team2Points;
    team2Stats.pointsAgainst += team1Points;

    if (!winnerId) {
      return;
    }

    const loserId = winnerId === team1Id ? team2Id : team1Id;

    const winnerStats = ensureTeamStats(statsMap, winnerId);
    const loserStats = ensureTeamStats(statsMap, loserId);

    if (winnerStats) {
      winnerStats.wins += 1;
    }

    if (loserStats) {
      loserStats.losses += 1;
    }
  });

  if (statsMap.size === 0) {
    await tx.standing.deleteMany({ where: { bracketId } });
    return [];
  }

  const standings = Array.from(statsMap.values()).map((entry) => {
    const quotient = computeQuotient(entry.pointsFor, entry.pointsAgainst);
    return {
      ...entry,
      quotient,
    };
  });

  standings.sort((a, b) => {
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }

    if (b.quotient !== a.quotient) {
      return b.quotient - a.quotient;
    }

    if (b.pointsFor !== a.pointsFor) {
      return b.pointsFor - a.pointsFor;
    }

    return a.teamId.localeCompare(b.teamId);
  });

  standings.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  await tx.standing.deleteMany({ where: { bracketId } });
  await tx.standing.createMany({
    data: standings.map((entry) => ({
      bracketId,
      teamId: entry.teamId,
      wins: entry.wins,
      losses: entry.losses,
      pointsFor: entry.pointsFor,
      pointsAgainst: entry.pointsAgainst,
      quotient: new Prisma.Decimal(entry.quotient.toFixed(4)),
      rank: entry.rank,
    })),
  });

  return standings;
}

module.exports = {
  recalculateBracketStandings,
};
