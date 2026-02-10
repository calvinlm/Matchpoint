const express = require('express');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/requireAuth');
const { validateBracketConfig } = require('../brackets/configValidation');
const { recordAuditLog } = require('../services/audit');
const { applySeeding } = require('../services/seeding');
const {
  getBracketSchedule,
  updateMatchAssignment,
  bulkRescheduleMatches,
  retireMatches,
  swapMatchCourts,
  setQueuePaused,
  reorderQueue,
  getTournamentQueue,
} = require('../services/scheduling');
const { submitMatchScore } = require('../services/scoring');

const router = express.Router({ mergeParams: true });

async function loadTournamentAndDivision(slug, divisionId) {
  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      divisions: {
        where: { id: divisionId },
      },
    },
  });

  if (!tournament) {
    return { error: { status: 404, message: `Tournament with slug "${slug}" not found` } };
  }

  const division = tournament.divisions[0];

  if (!division) {
    return {
      error: {
        status: 404,
        message: `Division ${divisionId} is not associated with tournament "${slug}"`,
      },
    };
  }

  return { tournament, division };
}

router.post(
  '/:slug/divisions/:divisionId/brackets',
  requireAuth,
  async (req, res) => {
    const { slug, divisionId } = req.params;
    const { type, config, locked = false } = req.body ?? {};

    if (!type || typeof type !== 'string') {
      return res.status(400).json({ error: 'type is required' });
    }

    let sanitizedConfig;
    try {
      sanitizedConfig = validateBracketConfig(type, config);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    try {
      const { tournament, division, error } = await loadTournamentAndDivision(slug, divisionId);
      if (error) {
        return res.status(error.status).json({ error: error.message });
      }

      const bracket = await prisma.bracket.create({
        data: {
          type,
          divisionId: division.id,
          config: sanitizedConfig,
          locked: Boolean(locked),
        },
      });

      await recordAuditLog({
        actor: req.user?.email ?? 'unknown',
        action: 'BRACKET_CREATE',
        resourceType: 'Bracket',
        resourceId: bracket.id,
        metadata: {
          tournamentId: tournament.id,
          divisionId: division.id,
          type,
        },
      });

      return res.status(201).json(bracket);
    } catch (error) {
      console.error('Failed to create bracket', error);
      return res.status(500).json({ error: 'Failed to create bracket' });
    }
  },
);

router.patch(
  '/:slug/brackets/:bracketId',
  requireAuth,
  async (req, res) => {
    const { slug, bracketId } = req.params;
    const { config, locked } = req.body ?? {};

    try {
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
        return res.status(404).json({ error: `Bracket ${bracketId} not found for tournament "${slug}"` });
      }

      if (bracket.locked && config !== undefined) {
        return res.status(409).json({ error: 'Bracket is locked and cannot be modified' });
      }

      let sanitizedConfig = undefined;
      if (config !== undefined) {
        try {
          sanitizedConfig = validateBracketConfig(bracket.type, config);
        } catch (error) {
          return res.status(400).json({ error: error.message });
        }
      }

      const updated = await prisma.bracket.update({
        where: { id: bracket.id },
        data: {
          config: sanitizedConfig ?? bracket.config,
          locked: locked !== undefined ? Boolean(locked) : bracket.locked,
        },
      });

      await recordAuditLog({
        actor: req.user?.email ?? 'unknown',
        action: 'BRACKET_UPDATE',
        resourceType: 'Bracket',
        resourceId: updated.id,
        metadata: {
          locked: updated.locked,
        },
      });

      return res.json(updated);
    } catch (error) {
      console.error('Failed to update bracket', error);
      return res.status(500).json({ error: 'Failed to update bracket' });
    }
  },
);

router.delete('/:slug/brackets/:bracketId', requireAuth, async (req, res) => {
  const { slug, bracketId } = req.params;

  try {
    const bracket = await prisma.bracket.findFirst({
      where: {
        id: bracketId,
        division: {
          tournament: {
            slug,
          },
        },
      },
      select: {
        id: true,
        divisionId: true,
      },
    });

    if (!bracket) {
      return res.status(404).json({ error: `Bracket ${bracketId} not found for tournament "${slug}"` });
    }

    await prisma.bracket.delete({
      where: { id: bracket.id },
    });

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'BRACKET_DELETE',
      resourceType: 'Bracket',
      resourceId: bracket.id,
      metadata: {
        divisionId: bracket.divisionId,
      },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Failed to delete bracket', error);
    return res.status(500).json({ error: 'Failed to delete bracket' });
  }
});

router.get('/:slug/brackets', async (req, res) => {
  const { slug } = req.params;

  try {
    const brackets = await prisma.bracket.findMany({
      where: {
        division: {
          tournament: {
            slug,
          },
        },
      },
      include: {
        division: true,
        seedings: {
          orderBy: { seed: 'asc' },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!brackets || brackets.length === 0) {
      const exists = await prisma.tournament.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!exists) {
        return res.status(404).json({ error: `Tournament with slug "${slug}" not found` });
      }
    }

    return res.json(brackets);
  } catch (error) {
    console.error('Failed to fetch brackets', error);
    return res.status(500).json({ error: 'Failed to fetch brackets' });
  }
});

router.get('/:slug/brackets/:bracketId/matches', requireAuth, async (req, res) => {
  const { slug, bracketId } = req.params;

  try {
    const bracket = await prisma.bracket.findFirst({
      where: {
        id: bracketId,
        division: {
          tournament: {
            slug,
          },
        },
      },
      select: {
        id: true,
        divisionId: true,
      },
    });

    if (!bracket) {
      return res.status(404).json({ error: `Bracket ${bracketId} not found for tournament "${slug}"` });
    }

    const matches = await prisma.match.findMany({
      where: { bracketId: bracket.id },
      include: {
        team1: {
          include: {
            registrations: true,
          },
        },
        team2: {
          include: {
            registrations: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const payload = matches.map((match) => {
      const mapTeam = (team) => {
        if (!team) {
          return null;
        }

        const registration = team.registrations?.find((entry) => entry.divisionId === bracket.divisionId);

        return {
          id: team.id,
          name: team.name,
          entryCode: registration?.entryCode ?? null,
        };
      };

      return {
        id: match.id,
        team1: mapTeam(match.team1),
        team2: mapTeam(match.team2),
        winnerId: match.winnerId,
        score: match.score,
        status: match.winnerId ? 'COMPLETED' : 'PENDING',
        createdAt: match.createdAt.toISOString(),
        updatedAt: match.updatedAt.toISOString(),
      };
    });

    return res.json({
      bracketId: bracket.id,
      matches: payload,
    });
  } catch (error) {
    console.error('Failed to load bracket matches', error);
    return res.status(500).json({ error: 'Failed to load bracket matches' });
  }
});

router.get('/:slug/queue', requireAuth, async (req, res) => {
  const { slug } = req.params;

  try {
    const result = await getTournamentQueue({ slug });
    return res.json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message) {
      return res.status(400).json({ error: error.message });
    }

    console.error('Failed to load tournament queue', error);
    return res.status(500).json({ error: 'Failed to load tournament queue' });
  }
});

router.get('/:slug/divisions/:divisionId/teams', requireAuth, async (req, res) => {
  const { slug, divisionId } = req.params;
  const { bracketId } = req.query;

  try {
    const { division, error } = await loadTournamentAndDivision(slug, divisionId);
    if (error) {
      return res.status(error.status).json({ error: error.message });
    }

    let seedLookup = new Map();

    if (bracketId) {
      const bracket = await prisma.bracket.findFirst({
        where: {
          id: bracketId,
          divisionId: division.id,
        },
        include: {
          seedings: true,
        },
      });

      if (!bracket) {
        return res.status(404).json({ error: `Bracket ${bracketId} not found in this division` });
      }

      seedLookup = new Map(bracket.seedings.map((seeding) => [seeding.teamId, seeding.seed]));
    }

    const registrations = await prisma.registration.findMany({
      where: { divisionId: division.id },
      include: {
        team: {
          include: {
            players: {
              include: {
                player: true,
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        },
      },
      orderBy: {
        entryCode: 'asc',
      },
    });

    const teams = registrations.map((registration) => ({
      teamId: registration.teamId,
      teamName: registration.team.name,
      entryCode: registration.entryCode,
      seed: seedLookup.get(registration.teamId) ?? null,
      players: registration.team.players.map((teamPlayer) => ({
        id: teamPlayer.playerId,
        firstName: teamPlayer.player.firstName,
        lastName: teamPlayer.player.lastName,
        dateOfBirth: teamPlayer.player.dateOfBirth,
      })),
    }));

    return res.json({ teams });
  } catch (error) {
    console.error('Failed to fetch division teams', error);
    return res.status(500).json({ error: 'Failed to fetch teams for division' });
  }
});

router.patch('/:slug/brackets/:bracketId/seeding', requireAuth, async (req, res) => {
  const { slug, bracketId } = req.params;
  const { entries } = req.body ?? {};

  try {
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
      return res.status(404).json({ error: `Bracket ${bracketId} not found for tournament "${slug}"` });
    }

    const result = await applySeeding({
      bracketId: bracket.id,
      entries,
      actor: req.user?.email ?? 'unknown',
    });

    return res.json(result);
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ error: error.message });
    }

    if (error.status === 409) {
      return res.status(409).json({ error: error.message });
    }

    if (error instanceof Error && error.message) {
      return res.status(400).json({ error: error.message });
    }

    console.error('Failed to apply bracket seeding', error);
    return res.status(500).json({ error: 'Failed to apply bracket seeding' });
  }
});

router.get('/:slug/brackets/:bracketId/schedule', requireAuth, async (req, res) => {
  const { slug, bracketId } = req.params;

  try {
    const schedule = await getBracketSchedule({ slug, bracketId });
    return res.json(schedule);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error('Failed to load schedule', error);
    return res.status(500).json({ error: 'Failed to load schedule' });
  }
});

router.get('/:slug/brackets/:bracketId/standings', requireAuth, async (req, res) => {
  const { slug, bracketId } = req.params;

  try {
    const bracket = await prisma.bracket.findFirst({
      where: {
        id: bracketId,
        division: {
          tournament: {
            slug,
          },
        },
      },
      select: {
        id: true,
        type: true,
        divisionId: true,
      },
    });

    if (!bracket) {
      return res.status(404).json({ error: `Bracket ${bracketId} not found for tournament "${slug}"` });
    }

    const standings = await prisma.standing.findMany({
      where: { bracketId: bracket.id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            registrations: {
              where: { divisionId: bracket.divisionId },
              select: {
                entryCode: true,
              },
            },
          },
        },
      },
      orderBy: { rank: 'asc' },
    });

    const payload = standings.map((row) => ({
      teamId: row.teamId,
      teamName: row.team?.name ?? 'Unknown Team',
      entryCode: row.team?.registrations?.[0]?.entryCode ?? null,
      wins: row.wins,
      losses: row.losses,
      pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst,
      quotient: Number(row.quotient ?? 0),
      rank: row.rank,
    }));

    return res.json({
      bracketId: bracket.id,
      type: bracket.type,
      standings: payload,
    });
  } catch (error) {
    console.error('Failed to load standings', error);
    return res.status(500).json({ error: 'Failed to load standings' });
  }
});

router.patch('/:slug/brackets/:bracketId/matches/:matchId/assignment', requireAuth, async (req, res) => {
  const { slug, bracketId, matchId } = req.params;
  const { courtId, startTime } = req.body ?? {};

  try {
    const parsedStartTime =
      startTime != null
        ? new Date(startTime)
        : undefined;

    if (parsedStartTime && Number.isNaN(parsedStartTime.valueOf())) {
      return res.status(400).json({ error: 'startTime must be a valid ISO date string' });
    }

    const result = await updateMatchAssignment({
      slug,
      bracketId,
      matchId,
      courtId: courtId ?? null,
      startTime: parsedStartTime,
      actor: req.user?.email ?? 'unknown',
    });

    return res.json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message) {
      console.error('Match assignment failed', error);
      return res.status(400).json({ error: error.message });
    }

    console.error('Failed to update match assignment', error);
    return res.status(500).json({ error: 'Failed to update match assignment' });
  }
});

router.patch('/:slug/brackets/:bracketId/schedule/reschedule', requireAuth, async (req, res) => {
  const { slug, bracketId } = req.params;
  const { updates } = req.body ?? {};

  try {
    const result = await bulkRescheduleMatches({
      slug,
      bracketId,
      updates,
      actor: req.user?.email ?? 'unknown',
    });

    return res.json({ matches: result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message) {
      console.error('Bulk reschedule failed', error);
      return res.status(400).json({ error: error.message });
    }

    console.error('Failed to reschedule matches', error);
    return res.status(500).json({ error: 'Failed to reschedule matches' });
  }
});

router.patch('/:slug/brackets/:bracketId/matches/:matchId/score', requireAuth, async (req, res) => {
  const { slug, bracketId, matchId } = req.params;
  const { games } = req.body ?? {};

  try {
    const result = await submitMatchScore({
      slug,
      bracketId,
      matchId,
      games,
      actor: req.user?.email ?? 'unknown',
    });

    return res.json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message) {
      console.error('Failed to submit match score', error);
      return res.status(400).json({ error: error.message });
    }

    console.error('Failed to submit match score', error);
    return res.status(500).json({ error: 'Failed to submit match score' });
  }
});

router.post('/:slug/brackets/:bracketId/matches/retire', requireAuth, async (req, res) => {
  const { slug, bracketId } = req.params;
  const { matchIds } = req.body ?? {};

  try {
    const result = await retireMatches({
      slug,
      bracketId,
      matchIds,
      actor: req.user?.email ?? 'unknown',
    });

    return res.json({ matches: result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message) {
      console.error('Retire matches failed', error);
      return res.status(400).json({ error: error.message });
    }

    console.error('Failed to retire matches', error);
    return res.status(500).json({ error: 'Failed to retire matches' });
  }
});

router.post('/:slug/brackets/:bracketId/matches/swap', requireAuth, async (req, res) => {
  const { slug, bracketId } = req.params;
  const { matchAId, matchBId } = req.body ?? {};

  try {
    const result = await swapMatchCourts({
      slug,
      bracketId,
      matchAId,
      matchBId,
      actor: req.user?.email ?? 'unknown',
    });

    return res.json({ matches: result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message) {
      console.error('Swap matches failed', error);
      return res.status(400).json({ error: error.message });
    }

    console.error('Failed to swap matches', error);
    return res.status(500).json({ error: 'Failed to swap matches' });
  }
});

router.patch('/:slug/brackets/:bracketId/queue', requireAuth, async (req, res) => {
  const { slug, bracketId } = req.params;
  const { paused } = req.body ?? {};

  try {
    const result = await setQueuePaused({
      slug,
      bracketId,
      paused,
      actor: req.user?.email ?? 'unknown',
    });

    return res.json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message) {
      console.error('Queue pause toggle failed', error);
      return res.status(400).json({ error: error.message });
    }

    console.error('Failed to update queue state', error);
    return res.status(500).json({ error: 'Failed to update queue state' });
  }
});

router.patch('/:slug/brackets/:bracketId/queue/reorder', requireAuth, async (req, res) => {
  const { slug, bracketId } = req.params;
  const { order } = req.body ?? {};

  try {
    const result = await reorderQueue({
      slug,
      bracketId,
      order,
      actor: req.user?.email ?? 'unknown',
    });

    return res.json({ matches: result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    if (error instanceof Error && error.message) {
      console.error('Queue reorder failed', error);
      return res.status(400).json({ error: error.message });
    }

    console.error('Failed to reorder queue', error);
    return res.status(500).json({ error: 'Failed to reorder queue' });
  }
});

module.exports = router;
