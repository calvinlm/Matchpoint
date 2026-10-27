const prisma = require('../lib/prisma');
const { recordAuditLog } = require('./audit');

// Queue order: lowest queueOrder first, matches without one last, then oldest first.
function compareQueueOrder(a, b) {
  if (a.queueOrder !== b.queueOrder) {
    if (a.queueOrder == null) return 1;
    if (b.queueOrder == null) return -1;
    return a.queueOrder - b.queueOrder;
  }

  const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();
  if (createdDiff !== 0) {
    return createdDiff;
  }

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function pickEntryCode(team, divisionId) {
  if (!team) {
    return null;
  }

  const registration = team.registrations?.find?.((item) => item.divisionId === divisionId);
  return registration?.entryCode ?? null;
}

function collectParticipants(match) {
  const teamIds = new Set();
  const playerIds = new Set();

  const addTeam = (team) => {
    if (!team) {
      return;
    }

    teamIds.add(team.id);

    team.players?.forEach((teamPlayer) => {
      if (teamPlayer.playerId) {
        playerIds.add(teamPlayer.playerId);
      }
    });
  };

  addTeam(match.team1);
  addTeam(match.team2);

  return { teamIds, playerIds };
}

function detectConflicts(targetMatch, activeMatches) {
  const conflicts = [];
  const targetParticipants = collectParticipants(targetMatch);

  activeMatches.forEach((otherMatch) => {
    if (otherMatch.id === targetMatch.id) {
      return;
    }

    const otherParticipants = collectParticipants(otherMatch);
    const sharedTeamIds = [...targetParticipants.teamIds].filter((teamId) => otherParticipants.teamIds.has(teamId));
    const sharedPlayerIds = [...targetParticipants.playerIds].filter((playerId) =>
      otherParticipants.playerIds.has(playerId),
    );

    if (sharedTeamIds.length === 0 && sharedPlayerIds.length === 0) {
      return;
    }

    conflicts.push({
      matchId: otherMatch.id,
      type: sharedTeamIds.length > 0 ? 'TEAM' : 'PLAYER',
      sharedTeamIds: sharedTeamIds.length > 0 ? sharedTeamIds : undefined,
      sharedPlayerIds: sharedPlayerIds.length > 0 ? sharedPlayerIds : undefined,
      otherMatch,
    });
  });

  return conflicts;
}

function mapTeamDetails(team, divisionId) {
  if (!team) {
    return null;
  }

  return {
    id: team.id,
    name: team.name,
    entryCode: pickEntryCode(team, divisionId),
    players:
      team.players?.map((teamPlayer) => {
        const player = teamPlayer.player ?? {};
        const id = teamPlayer.playerId ?? player.id ?? null;
        return {
          id,
          firstName: player.firstName ?? null,
          lastName: player.lastName ?? null,
        };
      }) ?? [],
  };
}

function extractPlayers(match, playerIds = []) {
  if (!playerIds || playerIds.length === 0) {
    return [];
  }

  const lookup = new Set(playerIds);
  const players = [];

  const addFromTeam = (team) => {
    team?.players?.forEach((teamPlayer) => {
      const player = teamPlayer.player ?? {};
      const id = teamPlayer.playerId ?? player.id;
      if (id && lookup.has(id)) {
        players.push({
          id,
          firstName: player.firstName ?? null,
          lastName: player.lastName ?? null,
        });
      }
    });
  };

  addFromTeam(match.team1);
  addFromTeam(match.team2);

  return players;
}

function normalizeScore(score) {
  if (!score || typeof score !== 'object') {
    return null;
  }

  const rawGames = Array.isArray(score.games) ? score.games : [];
  const games = rawGames
    .map((game) => {
      if (!game || typeof game !== 'object') {
        return null;
      }

      const team1 = Number(game.team1);
      const team2 = Number(game.team2);

      if (!Number.isFinite(team1) || !Number.isFinite(team2)) {
        return null;
      }

      return {
        team1,
        team2,
      };
    })
    .filter(Boolean);

  if (games.length === 0) {
    return null;
  }

  const bestOf = Number(score.bestOf);
  const winBy2 = Boolean(score.winBy2);
  const completedAt = typeof score.completedAt === 'string' ? score.completedAt : null;

  if (!Number.isInteger(bestOf) || bestOf <= 0) {
    return null;
  }

  return {
    games,
    bestOf,
    winBy2,
    completedAt,
  };
}

// `priority` is kept for the client's schema until P1-3 switches it to `queueOrder`:
// callers pass a value derived from queue position (higher = sooner), 0 when not queued.
function mapMatchToSummary(match, divisionId, conflicts = [], priority = 0) {
  return {
    id: match.id,
    bracketId: match.bracketId,
    divisionId: match.bracket.divisionId,
    courtId: match.courtId,
    startTime: match.startTime ? match.startTime.toISOString() : null,
    priority,
    queueOrder: match.queueOrder ?? null,
    status: match.status,
    team1: mapTeamDetails(match.team1, divisionId),
    team2: mapTeamDetails(match.team2, divisionId),
    score: normalizeScore(match.score),
    conflicts: conflicts.map((conflict) => ({
      matchId: conflict.matchId,
      type: conflict.type,
      sharedTeamIds: conflict.sharedTeamIds,
      sharedPlayerIds: conflict.sharedPlayerIds,
      sharedPlayers: extractPlayers(match, conflict.sharedPlayerIds ?? []),
      opponents: [mapTeamDetails(conflict.otherMatch?.team1, divisionId), mapTeamDetails(conflict.otherMatch?.team2, divisionId)].filter(Boolean),
      opponentPlayers: conflict.otherMatch ? extractPlayers(conflict.otherMatch, conflict.sharedPlayerIds ?? []) : [],
    })),
  };
}

async function getBracketSchedule({ slug, bracketId }) {
  const bracket = await prisma.bracket.findFirst({
    where: {
      id: bracketId,
      division: {
        tournament: {
          slug,
        },
      },
    },
    include: {
      division: {
        include: {
          tournament: {
            include: {
              courts: {
                orderBy: { label: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  if (!bracket) {
    throw Object.assign(new Error(`Bracket ${bracketId} not found for tournament "${slug}"`), { status: 404 });
  }

  const activeCourts = bracket.division.tournament.courts.filter((court) => court.active);

  const relevantMatches = await prisma.match.findMany({
    where: {
      bracketId,
      winnerId: null,
      status: { not: 'RETIRED' },
    },
    include: {
      team1: {
        include: {
          registrations: true,
          players: {
            include: {
              player: true,
            },
          },
        },
      },
      team2: {
        include: {
          registrations: true,
          players: {
            include: {
              player: true,
            },
          },
        },
      },
      bracket: {
        select: {
          id: true,
          divisionId: true,
        },
      },
    },
    orderBy: [
      { courtId: 'asc' },
      { startTime: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  const activeMatches = relevantMatches.filter((match) => match.courtId != null);
  const conflictCache = new Map(
    relevantMatches.map((match) => [match.id, detectConflicts(match, activeMatches)]),
  );

  const queueMatches = relevantMatches.filter((match) => match.courtId == null);
  queueMatches.sort(compareQueueOrder);

  const queue = queueMatches.map((match, index) =>
    mapMatchToSummary(match, bracket.divisionId, conflictCache.get(match.id) ?? [], queueMatches.length - index),
  );

  const courtAssignments = relevantMatches.filter((match) => match.courtId != null);

  const courts = activeCourts.map((court) => {
    const assignedMatch = courtAssignments.find((match) => match.courtId === court.id);
    return {
      id: court.id,
      label: court.label,
      active: court.active,
      assignment: assignedMatch
        ? mapMatchToSummary(assignedMatch, bracket.divisionId, conflictCache.get(assignedMatch.id) ?? [])
        : null,
    };
  });

  return {
    bracketId: bracket.id,
    divisionId: bracket.divisionId,
    queuePaused: bracket.queuePaused,
    courts,
    queue,
  };
}

async function updateMatchAssignment({ slug, bracketId, matchId, courtId, startTime, actor }) {
  const bracket = await prisma.bracket.findFirst({
    where: {
      id: bracketId,
      division: {
        tournament: {
          slug,
        },
      },
    },
    include: {
      division: {
        include: {
          tournament: {
            include: {
              courts: true,
            },
          },
        },
      },
    },
  });

  if (!bracket) {
    throw Object.assign(new Error(`Bracket ${bracketId} not found for tournament "${slug}"`), { status: 404 });
  }

  const existingMatch = await prisma.match.findFirst({
    where: {
      id: matchId,
      bracketId,
    },
    include: {
      bracket: {
        select: {
          id: true,
          divisionId: true,
        },
      },
      team1: {
        include: {
          registrations: true,
          players: {
            include: {
              player: true,
            },
          },
        },
      },
      team2: {
        include: {
          registrations: true,
          players: {
            include: {
              player: true,
            },
          },
        },
      },
    },
  });

  if (!existingMatch) {
    throw Object.assign(new Error(`Match ${matchId} not found for bracket ${bracketId}`), { status: 404 });
  }

  if (existingMatch.winnerId) {
    throw Object.assign(new Error('Completed matches cannot be reassigned'), { status: 409 });
  }

  let nextCourtId = null;
  if (courtId != null) {
    const targetCourt = bracket.division.tournament.courts.find((court) => court.id === courtId && court.active);

    if (!targetCourt) {
      throw Object.assign(new Error(`Court ${courtId} is not active for this tournament`), { status: 400 });
    }

    nextCourtId = targetCourt.id;
  }

  const result = await prisma.$transaction(async (tx) => {
    let activeMatches = [];

    // A paused bracket sends nothing new to court; moving or clearing a match already on court stays allowed.
    if (nextCourtId && existingMatch.courtId == null) {
      const { queuePaused } = await tx.bracket.findUnique({
        where: { id: bracket.id },
        select: { queuePaused: true },
      });

      if (queuePaused) {
        throw Object.assign(new Error("This bracket's queue is paused"), { status: 409 });
      }
    }

    if (nextCourtId) {
      const conflictingMatch = await tx.match.findFirst({
        where: {
          bracket: {
            division: {
              tournament: {
                slug,
              },
            },
          },
          courtId: nextCourtId,
          winnerId: null,
          NOT: {
            id: existingMatch.id,
          },
        },
        select: { id: true },
      });

      if (conflictingMatch) {
        throw Object.assign(new Error('Court is already assigned to an active match'), { status: 409 });
      }

      activeMatches = await tx.match.findMany({
        where: {
          bracket: {
            division: {
              tournament: {
                slug,
              },
            },
          },
          courtId: {
            not: null,
          },
          winnerId: null,
          NOT: {
            id: existingMatch.id,
          },
        },
        include: {
          team1: {
            include: {
              registrations: true,
              players: {
              include: {
                player: true,
              },
            },
            },
          },
          team2: {
            include: {
              registrations: true,
              players: {
              include: {
                player: true,
              },
            },
            },
          },
          bracket: {
            select: {
              id: true,
              divisionId: true,
            },
          },
        },
      });

      const conflicts = detectConflicts(existingMatch, activeMatches);
      if (conflicts.length > 0) {
        const conflict = conflicts[0];
        const conflictMatch = activeMatches.find((match) => match.id === conflict.matchId);
        let reason = 'Conflict with an active match';
        if (conflict.sharedTeamIds?.length) {
          const team = [conflictMatch?.team1, conflictMatch?.team2].find((item) =>
            conflict.sharedTeamIds.includes(item?.id),
          );
          reason = `Conflict: ${team?.name ?? 'team'} is already on court`;
        } else if (conflict.sharedPlayerIds?.length) {
          reason = 'Conflict: a player is already on court';
        }

        throw Object.assign(new Error(reason), { status: 409 });
      }
    }

    const nextStartTime = nextCourtId
      ? startTime === undefined
        ? existingMatch.startTime ?? new Date()
        : startTime ?? null
      : null;

    const updated = await tx.match.update({
      where: { id: existingMatch.id },
      data: {
        courtId: nextCourtId,
        startTime: nextStartTime,
        status: nextCourtId ? 'ACTIVE' : 'PENDING',
        startedAt: nextCourtId ? existingMatch.startedAt ?? new Date() : null,
      },
      include: {
        bracket: {
          select: {
            id: true,
            divisionId: true,
          },
        },
        team1: {
          include: {
            registrations: true,
            players: {
              include: {
                player: true,
              },
            },
          },
        },
        team2: {
          include: {
            registrations: true,
            players: {
              include: {
                player: true,
              },
            },
          },
        },
      },
    });

    await recordAuditLog(
      {
        actor,
        action: nextCourtId ? 'MATCH_ASSIGN' : 'MATCH_UNASSIGN',
        resourceType: 'Match',
        resourceId: updated.id,
        metadata: {
          courtId: nextCourtId,
          bracketId: updated.bracketId,
        },
      },
      tx,
    );

    const conflictsAfterUpdate =
      updated.courtId != null ? detectConflicts(updated, activeMatches) : [];

    return mapMatchToSummary(updated, bracket.divisionId, conflictsAfterUpdate);
  });

  return result;
}

async function bulkRescheduleMatches({ slug, bracketId, updates, actor }) {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error('updates must be a non-empty array');
  }

  const normalized = updates.map((update, index) => {
    if (typeof update !== 'object' || update == null) {
      throw new Error(`updates[${index}] must be an object`);
    }

    const { matchId, startTime, courtId } = update;

    if (!matchId || typeof matchId !== 'string') {
      throw new Error(`updates[${index}].matchId is required`);
    }

    let parsedStartTime;
    if (startTime !== undefined && startTime !== null) {
      parsedStartTime = new Date(startTime);
      if (Number.isNaN(parsedStartTime.valueOf())) {
        throw new Error(`updates[${index}].startTime must be a valid ISO date string`);
      }
    }

    if (courtId !== undefined && courtId !== null && typeof courtId !== 'string') {
      throw new Error(`updates[${index}].courtId must be null or a string`);
    }

    // Queue position is stored as Match.queueOrder and changed only through the queue reorder endpoint.
    if (Object.prototype.hasOwnProperty.call(update, 'priority')) {
      throw new Error(`updates[${index}].priority is no longer supported; reorder the queue instead`);
    }

    return {
      matchId,
      startTime: parsedStartTime,
      hasStartTime: startTime !== undefined,
      courtId: courtId ?? undefined,
    };
  });

  const results = [];

  for (const update of normalized) {
    if (update.courtId !== undefined) {
      let summary = await updateMatchAssignment({
        slug,
        bracketId,
        matchId: update.matchId,
        courtId: update.courtId,
        startTime: update.hasStartTime ? update.startTime ?? undefined : undefined,
        actor,
      });

      if (update.hasStartTime) {
        const updated = await prisma.match.update({
          where: { id: summary.id },
          data: {
            startTime: update.hasStartTime ? update.startTime ?? null : undefined,
          },
          include: {
            bracket: {
              select: {
                id: true,
                divisionId: true,
              },
            },
            team1: {
              include: {
                registrations: true,
                players: {
                  include: {
                    player: true,
                  },
                },
              },
            },
            team2: {
              include: {
                registrations: true,
                players: {
                  include: {
                    player: true,
                  },
                },
              },
            },
          },
        });

        await recordAuditLog({
          actor,
          action: 'MATCH_RESCHEDULE',
          resourceType: 'Match',
          resourceId: updated.id,
          metadata: {
            startTime: update.hasStartTime ? (update.startTime ? update.startTime.toISOString() : null) : undefined,
          },
        });

        summary = mapMatchToSummary(updated, updated.bracket.divisionId);
      }

      results.push(summary);
      continue;
    }

    const match = await prisma.match.findFirst({
      where: {
        id: update.matchId,
        bracket: {
          id: bracketId,
          division: {
            tournament: {
              slug,
            },
          },
        },
      },
      include: {
        bracket: {
          select: {
            id: true,
            divisionId: true,
          },
        },
        team1: {
          include: {
            registrations: true,
            players: {
              include: {
                player: true,
              },
            },
          },
        },
        team2: {
          include: {
            registrations: true,
            players: {
              include: {
                player: true,
              },
            },
          },
        },
      },
    });

    if (!match) {
      throw Object.assign(new Error(`Match ${update.matchId} not found for bracket ${bracketId}`), { status: 404 });
    }

    if (match.status === 'RETIRED') {
      throw Object.assign(new Error('Retired matches cannot be rescheduled'), { status: 409 });
    }

    const updated = await prisma.match.update({
      where: { id: match.id },
      data: {
        startTime: update.hasStartTime ? update.startTime ?? null : match.startTime,
      },
      include: {
        bracket: {
          select: {
            id: true,
            divisionId: true,
          },
        },
        team1: {
          include: {
            registrations: true,
            players: {
              include: {
                player: true,
              },
            },
          },
        },
        team2: {
          include: {
            registrations: true,
            players: {
              include: {
                player: true,
              },
            },
          },
        },
      },
    });

    await recordAuditLog({
      actor,
      action: 'MATCH_RESCHEDULE',
      resourceType: 'Match',
      resourceId: updated.id,
      metadata: {
        startTime: update.hasStartTime ? (update.startTime ? update.startTime.toISOString() : null) : undefined,
      },
    });

    results.push(mapMatchToSummary(updated, updated.bracket.divisionId));
  }

  return results;
}

async function retireMatches({ slug, bracketId, matchIds, actor }) {
  if (!Array.isArray(matchIds) || matchIds.length === 0) {
    throw new Error('matchIds must be a non-empty array');
  }

  const uniqueIds = [...new Set(matchIds)];

  const updates = [];

  await prisma.$transaction(async (tx) => {
    for (const matchId of uniqueIds) {
      const match = await tx.match.findFirst({
        where: {
          id: matchId,
          bracket: {
            id: bracketId,
            division: {
              tournament: {
                slug,
              },
            },
          },
        },
        include: {
          bracket: {
            select: {
              id: true,
              divisionId: true,
            },
          },
          team1: {
            include: {
              registrations: true,
              players: {
              include: {
                player: true,
              },
            },
            },
          },
          team2: {
            include: {
              registrations: true,
              players: {
              include: {
                player: true,
              },
            },
            },
          },
        },
      });

      if (!match) {
        throw Object.assign(new Error(`Match ${matchId} not found for bracket ${bracketId}`), { status: 404 });
      }

    if (match.status === 'COMPLETED') {
      throw Object.assign(new Error('Completed matches cannot be retired'), { status: 409 });
    }

      const updated = await tx.match.update({
        where: { id: match.id },
        data: {
          courtId: null,
          startTime: null,
          status: 'RETIRED',
        },
        include: {
          bracket: {
            select: {
              id: true,
              divisionId: true,
            },
          },
          team1: {
            include: {
              registrations: true,
              players: {
                include: {
                  player: true,
                },
              },
            },
          },
          team2: {
            include: {
              registrations: true,
              players: {
                include: {
                  player: true,
                },
              },
            },
          },
        },
      });

      await recordAuditLog(
        {
          actor,
          action: 'MATCH_RETIRE',
          resourceType: 'Match',
          resourceId: updated.id,
          metadata: {
            status: updated.status,
          },
        },
        tx,
      );

      updates.push(mapMatchToSummary(updated, updated.bracket.divisionId));
    }
  });

  return updates;
}

async function swapMatchCourts({ slug, bracketId, matchAId, matchBId, actor }) {
  if (!matchAId || !matchBId) {
    throw new Error('matchAId and matchBId are required');
  }

  if (matchAId === matchBId) {
    throw new Error('Cannot swap a match with itself');
  }

  const matches = await prisma.match.findMany({
    where: {
      id: { in: [matchAId, matchBId] },
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
      bracket: {
        select: {
          id: true,
          divisionId: true,
        },
      },
      team1: {
        include: {
          registrations: true,
          players: {
              include: {
                player: true,
              },
            },
        },
      },
      team2: {
        include: {
          registrations: true,
          players: {
              include: {
                player: true,
              },
            },
        },
      },
    },
  });

  if (matches.length !== 2) {
    throw Object.assign(new Error('Both matches must exist in the bracket'), { status: 404 });
  }

  const [matchA, matchB] = matches.sort((a, b) => (a.id === matchAId ? -1 : 1));

  if (!matchA.courtId || !matchB.courtId) {
    throw Object.assign(new Error('Both matches must be assigned to a court to swap'), { status: 409 });
  }

  if (matchA.status === 'RETIRED' || matchB.status === 'RETIRED') {
    throw Object.assign(new Error('Cannot swap retired matches'), { status: 409 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedA = await tx.match.update({
      where: { id: matchA.id },
      data: {
        courtId: matchB.courtId,
        startTime: matchB.startTime,
        status: 'ACTIVE',
      },
      include: {
        bracket: {
          select: {
            id: true,
            divisionId: true,
          },
        },
        team1: {
          include: {
            registrations: true,
            players: {
              include: {
                player: true,
              },
            },
          },
        },
        team2: {
          include: {
            registrations: true,
            players: {
              include: {
                player: true,
              },
            },
          },
        },
      },
    });

    const updatedB = await tx.match.update({
      where: { id: matchB.id },
      data: {
        courtId: matchA.courtId,
        startTime: matchA.startTime,
        status: 'ACTIVE',
      },
      include: {
        bracket: {
          select: {
            id: true,
            divisionId: true,
          },
        },
        team1: {
          include: {
            registrations: true,
            players: {
              include: {
                player: true,
              },
            },
          },
        },
        team2: {
          include: {
            registrations: true,
            players: {
              include: {
                player: true,
              },
            },
          },
        },
      },
    });

    await recordAuditLog(
      {
        actor,
        action: 'MATCH_SWAP_COURT',
        resourceType: 'Match',
        resourceId: updatedA.id,
        metadata: {
          courtId: updatedA.courtId,
        },
      },
      tx,
    );

    await recordAuditLog(
      {
        actor,
        action: 'MATCH_SWAP_COURT',
        resourceType: 'Match',
        resourceId: updatedB.id,
        metadata: {
          courtId: updatedB.courtId,
        },
      },
      tx,
    );

    return [
      mapMatchToSummary(updatedA, updatedA.bracket.divisionId),
      mapMatchToSummary(updatedB, updatedB.bracket.divisionId),
    ];
  });

  return result;
}

async function setQueuePaused({ slug, bracketId, paused, actor }) {
  const bracket = await prisma.bracket.findFirst({
    where: {
      id: bracketId,
      division: {
        tournament: {
          slug,
        },
      },
    },
  });

  if (!bracket) {
    throw Object.assign(new Error(`Bracket ${bracketId} not found for tournament "${slug}"`), { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.bracket.update({
      where: { id: bracket.id },
      data: { queuePaused: Boolean(paused) },
    });

    await recordAuditLog(
      {
        actor,
        action: paused ? 'BRACKET_QUEUE_PAUSE' : 'BRACKET_QUEUE_RESUME',
        resourceType: 'Bracket',
        resourceId: bracket.id,
        metadata: {
          queuePaused: Boolean(paused),
        },
      },
      tx,
    );
  });

  return {
    bracketId: bracket.id,
    queuePaused: Boolean(paused),
  };
}

async function reorderQueue({ slug, bracketId, order, actor }) {
  if (!Array.isArray(order) || order.length === 0) {
    throw new Error('order must be a non-empty array of match IDs');
  }

  const uniqueOrder = [...new Set(order)];
  if (uniqueOrder.length !== order.length) {
    throw new Error('order must not contain duplicate match IDs');
  }

  const matches = await prisma.match.findMany({
    where: {
      id: { in: uniqueOrder },
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
      bracket: {
        select: {
          id: true,
          divisionId: true,
        },
      },
      team1: {
        include: {
          registrations: true,
          players: {
            include: {
              player: true,
            },
          },
        },
      },
      team2: {
        include: {
          registrations: true,
          players: {
            include: {
              player: true,
            },
          },
        },
      },
    },
  });

  if (matches.length !== uniqueOrder.length) {
    throw Object.assign(new Error('All matches in order must exist for the bracket'), { status: 404 });
  }

  const matchMap = new Map(matches.map((match) => [match.id, match]));

  for (const matchId of uniqueOrder) {
    const match = matchMap.get(matchId);

    if (!match) {
      throw Object.assign(new Error(`Match ${matchId} not found for bracket ${bracketId}`), { status: 404 });
    }

    if (match.status === 'RETIRED') {
      throw Object.assign(new Error('Retired matches cannot be prioritized'), { status: 409 });
    }

    if (match.courtId) {
      throw Object.assign(new Error('Only queued matches can be reprioritized'), { status: 409 });
    }
  }

  const updates = await prisma.$transaction(async (tx) => {
    // The listed matches go first, in the given order; the rest of the queue keeps its order behind them.
    // P1-3 replaces this full renumbering with midpoint moves.
    const otherQueued = await tx.match.findMany({
      where: {
        bracketId,
        winnerId: null,
        courtId: null,
        status: { not: 'RETIRED' },
        id: { notIn: uniqueOrder },
      },
      select: { id: true, queueOrder: true, createdAt: true },
    });
    otherQueued.sort(compareQueueOrder);

    const fullOrder = [...uniqueOrder, ...otherQueued.map((match) => match.id)];
    const updatedMatches = [];

    for (let index = 0; index < fullOrder.length; index += 1) {
      const updated = await tx.match.update({
        where: { id: fullOrder[index] },
        data: { queueOrder: (index + 1) * 1000 },
        include: {
          bracket: {
            select: {
              id: true,
              divisionId: true,
            },
          },
          team1: {
            include: {
              registrations: true,
              players: {
                include: {
                  player: true,
                },
              },
            },
          },
          team2: {
            include: {
              registrations: true,
              players: {
                include: {
                  player: true,
                },
              },
            },
          },
        },
      });

      if (index < uniqueOrder.length) {
        updatedMatches.push(updated);
      }
    }

    await recordAuditLog(
      {
        actor,
        action: 'QUEUE_REORDER',
        resourceType: 'Bracket',
        resourceId: bracketId,
        metadata: {
          order: uniqueOrder,
        },
      },
      tx,
    );

    return { updatedMatches, queueLength: fullOrder.length };
  });

  return updates.updatedMatches.map((match, index) =>
    mapMatchToSummary(match, match.bracket.divisionId, [], updates.queueLength - index),
  );
}

async function getTournamentQueue({ slug }) {
  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
    },
  });

  if (!tournament) {
    throw Object.assign(new Error(`Tournament with slug "${slug}" not found`), { status: 404 });
  }

  const brackets = await prisma.bracket.findMany({
    where: {
      division: {
        tournamentId: tournament.id,
      },
    },
    include: {
      division: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const schedules = await Promise.all(
    brackets.map((bracket) =>
      getBracketSchedule({
        slug,
        bracketId: bracket.id,
      }),
    ),
  );

  const queues = schedules.map((schedule, index) => {
    const bracketMeta = brackets[index];
    return {
      bracketId: schedule.bracketId,
      bracketType: bracketMeta.type,
      divisionId: schedule.divisionId,
      divisionName: bracketMeta.division.name,
      queuePaused: schedule.queuePaused,
      queue: schedule.queue,
      bracketOrder: index,
    };
  });

  const globalQueue = queues
    .flatMap((entry) =>
      entry.queue.map((match, position) => ({
        ...match,
        divisionName: entry.divisionName,
        bracketType: entry.bracketType,
        queuePaused: entry.queuePaused,
        bracketOrder: entry.bracketOrder,
        queuePosition: position,
      })),
    )
    // queueOrder is numbered per bracket, so brackets stay in creation order, each in its own queue order.
    .sort((a, b) => {
      if (a.bracketOrder !== b.bracketOrder) {
        return a.bracketOrder - b.bracketOrder;
      }

      return a.queuePosition - b.queuePosition;
    })
    .map(({ bracketOrder, queuePosition, ...rest }) => rest);

  return {
    slug,
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    updatedAt: new Date().toISOString(),
    queues: queues.map(({ bracketOrder, ...rest }) => rest),
    globalQueue,
  };
}

module.exports = {
  getBracketSchedule,
  updateMatchAssignment,
  bulkRescheduleMatches,
  retireMatches,
  swapMatchCourts,
  setQueuePaused,
  reorderQueue,
  getTournamentQueue,
};
