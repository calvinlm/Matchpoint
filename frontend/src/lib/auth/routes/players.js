const express = require('express');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/requireAuth');
const { recordAuditLog } = require('../services/audit');

const router = express.Router();

function parseDate(value, fieldName, errors) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    errors.push(`${fieldName} must be a valid ISO 8601 string`);
    return null;
  }

  return parsed;
}

router.get('/', requireAuth, async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const take = Math.min(Number.parseInt(req.query.limit, 10) || 100, 100);

  try {
    const players = await prisma.player.findMany({
      where: search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
      take,
      include: {
        teams: {
          include: {
            team: true,
          },
        },
      },
    });

    const payload = players.map((player) => ({
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      gender: player.gender,
      dateOfBirth: player.dateOfBirth,
      createdAt: player.createdAt,
      updatedAt: player.updatedAt,
      teams: player.teams.map((teamPlayer) => ({
        teamId: teamPlayer.teamId,
        teamName: teamPlayer.team?.name ?? null,
      })),
    }));

    return res.json({ players: payload });
  } catch (error) {
    console.error('Failed to list players', error);
    return res.status(500).json({ error: 'Failed to list players' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { firstName, lastName, gender, dateOfBirth } = req.body ?? {};
  const errors = [];

  const normalizedFirstName = typeof firstName === 'string' ? firstName.trim() : '';
  const normalizedLastName = typeof lastName === 'string' ? lastName.trim() : '';
  const normalizedGender = typeof gender === 'string' ? gender.trim() : null;
  const normalizedDob = parseDate(dateOfBirth, 'dateOfBirth', errors);

  if (!normalizedFirstName) {
    errors.push('firstName is required');
  }

  if (!normalizedLastName) {
    errors.push('lastName is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const player = await prisma.player.create({
      data: {
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        gender: normalizedGender,
        dateOfBirth: normalizedDob,
      },
    });

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'PLAYER_CREATE',
      resourceType: 'Player',
      resourceId: player.id,
      metadata: {
        firstName: player.firstName,
        lastName: player.lastName,
      },
    });

    return res.status(201).json(player);
  } catch (error) {
    console.error('Failed to create player', error);
    return res.status(500).json({ error: 'Failed to create player' });
  }
});

router.patch('/:playerId', requireAuth, async (req, res) => {
  const { playerId } = req.params;
  const { firstName, lastName, gender, dateOfBirth } = req.body ?? {};
  const errors = [];
  const updates = {};
  let hasChanges = false;

  if (firstName !== undefined) {
    const normalized = typeof firstName === 'string' ? firstName.trim() : '';
    if (!normalized) {
      errors.push('firstName must be a non-empty string');
    } else {
      updates.firstName = normalized;
      hasChanges = true;
    }
  }

  if (lastName !== undefined) {
    const normalized = typeof lastName === 'string' ? lastName.trim() : '';
    if (!normalized) {
      errors.push('lastName must be a non-empty string');
    } else {
      updates.lastName = normalized;
      hasChanges = true;
    }
  }

  if (gender !== undefined) {
    updates.gender = gender === null ? null : typeof gender === 'string' ? gender.trim() : null;
    hasChanges = true;
  }

  if (dateOfBirth !== undefined) {
    if (dateOfBirth === null || dateOfBirth === '') {
      updates.dateOfBirth = null;
      hasChanges = true;
    } else {
      const parsed = parseDate(dateOfBirth, 'dateOfBirth', errors);
      if (parsed) {
        updates.dateOfBirth = parsed;
        hasChanges = true;
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  if (!hasChanges) {
    return res.status(400).json({ error: 'No valid fields provided for update' });
  }

  try {
    const existing = await prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: `Player ${playerId} not found` });
    }

    const updated = await prisma.player.update({
      where: { id: playerId },
      data: updates,
    });

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'PLAYER_UPDATE',
      resourceType: 'Player',
      resourceId: updated.id,
      metadata: updates,
    });

    return res.json(updated);
  } catch (error) {
    console.error('Failed to update player', error);
    return res.status(500).json({ error: 'Failed to update player' });
  }
});

router.delete('/:playerId', requireAuth, async (req, res) => {
  const { playerId } = req.params;

  try {
    const existing = await prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!existing) {
      return res.status(404).json({ error: `Player ${playerId} not found` });
    }

    await prisma.player.delete({
      where: { id: playerId },
    });

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'PLAYER_DELETE',
      resourceType: 'Player',
      resourceId: existing.id,
      metadata: {
        firstName: existing.firstName,
        lastName: existing.lastName,
      },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Failed to delete player', error);
    return res.status(500).json({ error: 'Failed to delete player' });
  }
});

module.exports = router;
