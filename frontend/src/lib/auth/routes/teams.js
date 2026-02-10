const express = require('express');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/requireAuth');
const { recordAuditLog } = require('../services/audit');

const router = express.Router();

async function resolvePlayers(tx, roster = []) {
  const playerIds = [];

  for (const entry of roster) {
    if (!entry) {
      continue;
    }

    if (entry.id) {
      const existing = await tx.player.findUnique({
        where: { id: entry.id },
        select: { id: true },
      });

      if (!existing) {
        throw Object.assign(new Error(`Player ${entry.id} not found`), { status: 404 });
      }

      playerIds.push(existing.id);
      continue;
    }

    const firstName = typeof entry.firstName === 'string' ? entry.firstName.trim() : '';
    const lastName = typeof entry.lastName === 'string' ? entry.lastName.trim() : '';
    const gender = typeof entry.gender === 'string' ? entry.gender.trim() : null;
    const dobValue = entry.dateOfBirth ? new Date(entry.dateOfBirth) : null;

    if (!firstName || !lastName) {
      throw Object.assign(new Error('players must include firstName and lastName'), { status: 400 });
    }

    if (dobValue && Number.isNaN(dobValue.valueOf())) {
      throw Object.assign(new Error('dateOfBirth must be a valid ISO 8601 string'), { status: 400 });
    }

    const created = await tx.player.create({
      data: {
        firstName,
        lastName,
        gender,
        dateOfBirth: dobValue,
      },
      select: {
        id: true,
      },
    });

    playerIds.push(created.id);
  }

  return playerIds;
}

function mapTeam(team) {
  return {
    id: team.id,
    name: team.name,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    players: team.players.map((teamPlayer) => ({
      id: teamPlayer.playerId,
      firstName: teamPlayer.player.firstName,
      lastName: teamPlayer.player.lastName,
      dateOfBirth: teamPlayer.player.dateOfBirth,
      gender: teamPlayer.player.gender,
    })),
    registrations: team.registrations.map((registration) => ({
      id: registration.id,
      divisionId: registration.divisionId,
      divisionName: registration.division?.name ?? null,
      tournamentSlug: registration.division?.tournament?.slug ?? null,
      entryCode: registration.entryCode,
      seedNote: registration.seedNote,
    })),
  };
}

router.get('/', requireAuth, async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const tournamentSlug = typeof req.query.tournamentSlug === 'string' ? req.query.tournamentSlug.trim() : '';
  const divisionId = typeof req.query.divisionId === 'string' ? req.query.divisionId.trim() : '';

  const filters = [];

  if (search) {
    filters.push({ name: { contains: search, mode: 'insensitive' } });
  }

  if (tournamentSlug) {
    filters.push({
      registrations: {
        some: {
          division: {
            tournament: {
              slug: tournamentSlug,
            },
          },
        },
      },
    });
  }

  if (divisionId) {
    filters.push({
      registrations: {
        some: {
          divisionId,
        },
      },
    });
  }

  const where = filters.length > 0 ? { AND: filters } : undefined;

  try {
    const teams = await prisma.team.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
      include: {
        players: {
          include: {
            player: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        registrations: {
          include: {
            division: {
              select: {
                id: true,
                name: true,
                tournament: {
                  select: {
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return res.json({
      teams: teams.map(mapTeam),
    });
  } catch (error) {
    console.error('Failed to list teams', error);
    return res.status(500).json({ error: 'Failed to list teams' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { name, players } = req.body ?? {};
  const trimmedName = typeof name === 'string' ? name.trim() : '';

  if (!trimmedName) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const team = await prisma.$transaction(async (tx) => {
      const createdTeam = await tx.team.create({
        data: {
          name: trimmedName,
        },
      });

      const roster = Array.isArray(players) ? players : [];

      if (roster.length > 0) {
        const playerIds = await resolvePlayers(tx, roster);

        await tx.teamPlayer.createMany({
          data: playerIds.map((playerId) => ({
            teamId: createdTeam.id,
            playerId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.team.findUnique({
        where: { id: createdTeam.id },
        include: {
          players: {
            include: {
              player: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          registrations: {
            include: {
              division: {
                select: {
                  id: true,
                  name: true,
                  tournament: {
                    select: { slug: true },
                  },
                },
              },
            },
          },
        },
      });
    });

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'TEAM_CREATE',
      resourceType: 'Team',
      resourceId: team.id,
      metadata: {
        name: team.name,
      },
    });

    return res.status(201).json(mapTeam(team));
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error('Failed to create team', error);
    return res.status(500).json({ error: 'Failed to create team' });
  }
});

router.patch('/:teamId', requireAuth, async (req, res) => {
  const { teamId } = req.params;
  const { name, players } = req.body ?? {};

  if (!teamId) {
    return res.status(400).json({ error: 'teamId is required' });
  }

  const updates = {};
  let hasChanges = false;

  if (name !== undefined) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) {
      return res.status(400).json({ error: 'name must be a non-empty string' });
    }
    updates.name = trimmed;
    hasChanges = true;
  }

  try {
    const team = await prisma.$transaction(async (tx) => {
      const existing = await tx.team.findUnique({
        where: { id: teamId },
        select: { id: true },
      });

      if (!existing) {
        throw Object.assign(new Error(`Team ${teamId} not found`), { status: 404 });
      }

      if (hasChanges) {
        await tx.team.update({
          where: { id: teamId },
          data: updates,
        });
      }

      const roster = Array.isArray(players) ? players : null;

      if (Array.isArray(roster)) {
        const playerIds = await resolvePlayers(tx, roster);

        await tx.teamPlayer.deleteMany({
          where: {
            teamId,
            playerId: { notIn: playerIds },
          },
        });

        if (playerIds.length > 0) {
          await tx.teamPlayer.createMany({
            data: playerIds.map((playerId) => ({
              teamId,
              playerId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.team.findUnique({
        where: { id: teamId },
        include: {
          players: {
            include: {
              player: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          registrations: {
            include: {
              division: {
                select: {
                  id: true,
                  name: true,
                  tournament: {
                    select: { slug: true },
                  },
                },
              },
            },
          },
        },
      });
    });

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'TEAM_UPDATE',
      resourceType: 'Team',
      resourceId: team.id,
      metadata: {
        ...(updates.name ? { name: updates.name } : {}),
        rosterUpdated: Array.isArray(players),
      },
    });

    return res.json(mapTeam(team));
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error('Failed to update team', error);
    return res.status(500).json({ error: 'Failed to update team' });
  }
});

router.delete('/:teamId', requireAuth, async (req, res) => {
  const { teamId } = req.params;

  try {
    const existing = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true },
    });

    if (!existing) {
      return res.status(404).json({ error: `Team ${teamId} not found` });
    }

    await prisma.team.delete({
      where: { id: teamId },
    });

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'TEAM_DELETE',
      resourceType: 'Team',
      resourceId: existing.id,
      metadata: {
        name: existing.name,
      },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Failed to delete team', error);
    return res.status(500).json({ error: 'Failed to delete team' });
  }
});

module.exports = router;
