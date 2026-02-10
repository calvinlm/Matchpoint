const express = require('express');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/requireAuth');
const { recordAuditLog } = require('../services/audit');
const { parseConsolidatedCsv } = require('../import/csvImporter');
const { buildTournamentExportCsv } = require('../import/csvExporter');
const { assignEntryCodes, parseExistingSequence } = require('../import/entryCode');
const { getTournamentQueue } = require('../services/scheduling');

const router = express.Router();

const VALID_LEVELS = new Set(['NOV', 'INT', 'ADV', 'OPN']);
const VALID_AGE_GROUPS = new Set(['JUNIOR', 'A18', 'A35', 'A50']);

router.get('/', requireAuth, async (_req, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            divisions: true,
            courts: true,
          },
        },
      },
    });

    const payload = tournaments.map((tournament) => ({
      id: tournament.id,
      slug: tournament.slug,
      name: tournament.name,
      location: tournament.location,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      plannedCourtCount: tournament.plannedCourtCount,
      divisionCount: tournament._count.divisions,
      courtCount: tournament._count.courts,
      createdAt: tournament.createdAt,
      updatedAt: tournament.updatedAt,
    }));

    return res.json({ tournaments: payload });
  } catch (error) {
    console.error('Failed to list tournaments', error);
    return res.status(500).json({ error: 'Failed to list tournaments' });
  }
});

/**
 * Normalizes date strings to Date instances or null.
 */
function normalizeDate(value, fieldName, errors) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    errors.push(`${fieldName} must be a valid ISO 8601 date string`);
    return null;
  }

  return parsed;
}

/**
 * Creates tournament data from the request payload.
 * Shared by POST and PATCH handlers to keep validation consistent.
 */
function validateTournamentPayload(body, { requireSlug = true } = {}) {
  const {
    name,
    slug,
    plannedCourtCount,
    startDate,
    endDate,
    location,
  } = body ?? {};

  const validationErrors = [];

  const trimmedName =
    typeof name === 'string' && name.trim().length > 0 ? name.trim() : null;
  const trimmedSlug =
    typeof slug === 'string' && slug.trim().length > 0 ? slug.trim() : null;
  const trimmedLocation =
    typeof location === 'string' && location.trim().length > 0 ? location.trim() : null;

  if (!trimmedName) {
    validationErrors.push('name is required');
  }

  if (requireSlug && !trimmedSlug) {
    validationErrors.push('slug is required');
  }

  let normalizedCourtCount = null;

  if (plannedCourtCount !== undefined) {
    const parsed = Number(plannedCourtCount);
    if (!Number.isInteger(parsed) || parsed < 0) {
      validationErrors.push('plannedCourtCount must be a non-negative integer when provided');
    } else {
      normalizedCourtCount = parsed;
    }
  }

  const normalizedStartDate = normalizeDate(startDate, 'startDate', validationErrors);
  const normalizedEndDate = normalizeDate(endDate, 'endDate', validationErrors);

  if (
    normalizedStartDate &&
    normalizedEndDate &&
    normalizedEndDate < normalizedStartDate
  ) {
    validationErrors.push('endDate must be on or after startDate when both are provided');
  }

  return {
    validationErrors,
    trimmedName,
    trimmedSlug,
    trimmedLocation,
    normalizedCourtCount,
    normalizedStartDate,
    normalizedEndDate,
  };
}

function extractDivisionUpdates(body = {}) {
  const { name, level, ageGroup, format } = body;
  const errors = [];
  const updates = {};
  let hasChanges = false;

  if (name !== undefined) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) {
      errors.push('name must be a non-empty string');
    } else {
      updates.name = trimmed;
      hasChanges = true;
    }
  }

  if (level !== undefined) {
    const normalizedLevel = typeof level === 'string' ? level.trim().toUpperCase() : '';
    if (!VALID_LEVELS.has(normalizedLevel)) {
      errors.push('level must be one of NOV/INT/ADV/OPN');
    } else {
      updates.level = normalizedLevel;
      hasChanges = true;
    }
  }

  if (ageGroup !== undefined) {
    const normalizedAgeGroup = typeof ageGroup === 'string' ? ageGroup.trim().toUpperCase() : '';
    if (!VALID_AGE_GROUPS.has(normalizedAgeGroup)) {
      errors.push('ageGroup must be one of JUNIOR/A18/A35/A50');
    } else {
      updates.ageGroup = normalizedAgeGroup;
      hasChanges = true;
    }
  }

  if (format !== undefined) {
    const trimmedFormat = typeof format === 'string' ? format.trim().toUpperCase() : '';
    if (!trimmedFormat) {
      errors.push('format must be provided when updating');
    } else {
      updates.format = trimmedFormat;
      hasChanges = true;
    }
  }

  return { errors, updates, hasChanges };
}

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
    const dateOfBirthValue = entry.dateOfBirth ? new Date(entry.dateOfBirth) : null;

    if (!firstName || !lastName) {
      throw Object.assign(new Error('players must include firstName and lastName'), { status: 400 });
    }

    if (dateOfBirthValue && Number.isNaN(dateOfBirthValue.valueOf())) {
      throw Object.assign(new Error('dateOfBirth must be an ISO 8601 string'), { status: 400 });
    }

    const created = await tx.player.create({
      data: {
        firstName,
        lastName,
        gender,
        dateOfBirth: dateOfBirthValue,
      },
      select: {
        id: true,
      },
    });

    playerIds.push(created.id);
  }

  return playerIds;
}

/**
 * POST /api/v1/tournaments
 * Creates a tournament and seeds courts 1..N when plannedCourtCount > 0.
 */
router.post('/', requireAuth, async (req, res) => {
  const {
    validationErrors,
    trimmedName,
    trimmedSlug,
    trimmedLocation,
    normalizedCourtCount,
    normalizedStartDate,
    normalizedEndDate,
  } = validateTournamentPayload(req.body, { requireSlug: true });

  if (validationErrors.length > 0) {
    return res.status(400).json({ errors: validationErrors });
  }

  const courtData =
    normalizedCourtCount && normalizedCourtCount > 0
      ? Array.from({ length: normalizedCourtCount }, (_, index) => ({
          label: String(index + 1),
        }))
      : undefined;

  try {
    const createdTournament = await prisma.tournament.create({
      data: {
        name: trimmedName,
        slug: trimmedSlug,
        plannedCourtCount: normalizedCourtCount,
        location: trimmedLocation,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
        courts: courtData ? { create: courtData } : undefined,
      },
      include: {
        courts: true,
      },
    });

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'TOURNAMENT_CREATE',
      resourceType: 'Tournament',
      resourceId: createdTournament.id,
      metadata: {
        slug: createdTournament.slug,
      },
    });

    return res.status(201).json(createdTournament);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: `Tournament with slug "${trimmedSlug}" already exists`,
      });
    }

    console.error('Failed to create tournament', error);
    return res.status(500).json({ error: 'Failed to create tournament' });
  }
});

router.get('/:slug/divisions', requireAuth, async (req, res) => {
  const slug = req.params.slug?.trim();

  if (!slug) {
    return res.status(400).json({ error: 'slug is required' });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { slug },
      select: {
        id: true,
        divisions: {
          orderBy: { createdAt: 'asc' },
          include: {
            _count: {
              select: {
                brackets: true,
                registrations: true,
              },
            },
          },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({ error: `Tournament with slug "${slug}" not found` });
    }

    const divisions = tournament.divisions.map((division) => ({
      id: division.id,
      name: division.name,
      level: division.level,
      ageGroup: division.ageGroup,
      format: division.format,
      bracketCount: division._count.brackets,
      teamCount: division._count.registrations,
      createdAt: division.createdAt,
      updatedAt: division.updatedAt,
    }));

    return res.json({ divisions });
  } catch (error) {
    console.error('Failed to list divisions', error);
    return res.status(500).json({ error: 'Failed to list divisions' });
  }
});

router.post('/:slug/divisions', requireAuth, async (req, res) => {
  const slug = req.params.slug?.trim();

  if (!slug) {
    return res.status(400).json({ error: 'slug is required' });
  }

  const {
    name,
    level,
    ageGroup,
    format,
  } = req.body ?? {};

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const normalizedLevel = typeof level === 'string' ? level.trim().toUpperCase() : '';
  const normalizedAgeGroup = typeof ageGroup === 'string' ? ageGroup.trim().toUpperCase() : '';
  const trimmedFormat = typeof format === 'string' ? format.trim().toUpperCase() : '';

  const validationErrors = [];

  if (!trimmedName) {
    validationErrors.push('name is required');
  }

  if (!VALID_LEVELS.has(normalizedLevel)) {
    validationErrors.push('level must be one of NOV/INT/ADV/OPN');
  }

  if (!VALID_AGE_GROUPS.has(normalizedAgeGroup)) {
    validationErrors.push('ageGroup must be one of JUNIOR/A18/A35/A50');
  }

  if (!trimmedFormat) {
    validationErrors.push('format is required');
  }

  if (validationErrors.length > 0) {
    return res.status(400).json({ errors: validationErrors });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!tournament) {
      return res.status(404).json({ error: `Tournament with slug "${slug}" not found` });
    }

    const existing = await prisma.division.findFirst({
      where: {
        tournamentId: tournament.id,
        name: trimmedName,
        level: normalizedLevel,
        ageGroup: normalizedAgeGroup,
        format: trimmedFormat,
      },
    });

    if (existing) {
      return res.status(409).json({ error: 'Division with the same name/level/ageGroup/format already exists' });
    }

    const division = await prisma.division.create({
      data: {
        name: trimmedName,
        level: normalizedLevel,
        ageGroup: normalizedAgeGroup,
        format: trimmedFormat,
        tournamentId: tournament.id,
      },
    });

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'DIVISION_CREATE',
      resourceType: 'Division',
      resourceId: division.id,
      metadata: {
        tournamentId: tournament.id,
      },
    });

    return res.status(201).json(division);
  } catch (error) {
    console.error('Failed to create division', error);
    return res.status(500).json({ error: 'Failed to create division' });
  }
});

router.get('/:slug/divisions/:divisionId', requireAuth, async (req, res) => {
  const { slug, divisionId } = req.params;

  if (!slug || !divisionId) {
    return res.status(400).json({ error: 'slug and divisionId are required' });
  }

  try {
    const division = await prisma.division.findFirst({
      where: {
        id: divisionId,
        tournament: {
          slug,
        },
      },
      include: {
        brackets: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            type: true,
            locked: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                matches: true,
              },
            },
          },
        },
        registrations: {
          orderBy: { entryCode: 'asc' },
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!division) {
      return res.status(404).json({ error: `Division ${divisionId} not found for tournament "${slug}"` });
    }

    return res.json({
      id: division.id,
      name: division.name,
      level: division.level,
      ageGroup: division.ageGroup,
      format: division.format,
      createdAt: division.createdAt,
      updatedAt: division.updatedAt,
      bracketCount: division.brackets.length,
      teamCount: division.registrations.length,
      brackets: division.brackets.map((bracket) => ({
        id: bracket.id,
        type: bracket.type,
        locked: bracket.locked,
        matchCount: bracket._count.matches,
        createdAt: bracket.createdAt,
        updatedAt: bracket.updatedAt,
      })),
      teams: division.registrations.map((registration) => ({
        registrationId: registration.id,
        teamId: registration.teamId,
        teamName: registration.team?.name ?? 'Unknown team',
        entryCode: registration.entryCode,
        seedNote: registration.seedNote,
      })),
    });
  } catch (error) {
    console.error('Failed to load division', error);
    return res.status(500).json({ error: 'Failed to load division' });
  }
});

router.patch('/:slug/divisions/:divisionId', requireAuth, async (req, res) => {
  const { slug, divisionId } = req.params;

  if (!slug || !divisionId) {
    return res.status(400).json({ error: 'slug and divisionId are required' });
  }

  const { errors, updates, hasChanges } = extractDivisionUpdates(req.body ?? {});

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  if (!hasChanges) {
    return res.status(400).json({ error: 'No valid fields provided for update' });
  }

  try {
    const division = await prisma.division.findFirst({
      where: {
        id: divisionId,
        tournament: {
          slug,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!division) {
      return res.status(404).json({ error: `Division ${divisionId} not found for tournament "${slug}"` });
    }

    const updated = await prisma.division.update({
      where: { id: division.id },
      data: updates,
    });

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'DIVISION_UPDATE',
      resourceType: 'Division',
      resourceId: division.id,
      metadata: updates,
    });

    return res.json(updated);
  } catch (error) {
    console.error('Failed to update division', error);
    return res.status(500).json({ error: 'Failed to update division' });
  }
});

router.delete('/:slug/divisions/:divisionId', requireAuth, async (req, res) => {
  const { slug, divisionId } = req.params;

  if (!slug || !divisionId) {
    return res.status(400).json({ error: 'slug and divisionId are required' });
  }

  try {
    const division = await prisma.division.findFirst({
      where: {
        id: divisionId,
        tournament: {
          slug,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!division) {
      return res.status(404).json({ error: `Division ${divisionId} not found for tournament "${slug}"` });
    }

    await prisma.division.delete({
      where: { id: division.id },
    });

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'DIVISION_DELETE',
      resourceType: 'Division',
      resourceId: division.id,
      metadata: {
        slug,
        name: division.name,
      },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Failed to delete division', error);
    return res.status(500).json({ error: 'Failed to delete division' });
  }
});

router.post('/:slug/divisions/:divisionId/registrations', requireAuth, async (req, res) => {
  const { slug, divisionId } = req.params;
  const { teamId, team, players, seedNote } = req.body ?? {};

  if (!slug || !divisionId) {
    return res.status(400).json({ error: 'slug and divisionId are required' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const division = await tx.division.findFirst({
        where: {
          id: divisionId,
          tournament: {
            slug,
          },
        },
        select: {
          id: true,
          name: true,
          level: true,
          ageGroup: true,
          tournamentId: true,
        },
      });

      if (!division) {
        throw Object.assign(new Error(`Division ${divisionId} not found for tournament "${slug}"`), { status: 404 });
      }

      let workingTeamId = null;
      let teamName = null;

      if (teamId) {
        const existingTeam = await tx.team.findUnique({
          where: { id: teamId },
          select: { id: true, name: true },
        });

        if (!existingTeam) {
          throw Object.assign(new Error(`Team ${teamId} not found`), { status: 404 });
        }

        workingTeamId = existingTeam.id;
        teamName = existingTeam.name;
      } else {
        const providedName = typeof team?.name === 'string' ? team.name.trim() : '';
        if (!providedName) {
          throw Object.assign(new Error('team.name is required when teamId is not provided'), { status: 400 });
        }

        const createdTeam = await tx.team.create({
          data: {
            name: providedName,
          },
          select: {
            id: true,
            name: true,
          },
        });

        workingTeamId = createdTeam.id;
        teamName = createdTeam.name;
      }

      const roster = Array.isArray(players)
        ? players
        : Array.isArray(team?.players)
          ? team.players
          : [];

      if (roster.length > 0) {
        const playerIds = await resolvePlayers(tx, roster);

        await tx.teamPlayer.deleteMany({
          where: {
            teamId: workingTeamId,
            playerId: { notIn: playerIds },
          },
        });

        await tx.teamPlayer.createMany({
          data: playerIds.map((playerId) => ({
            teamId: workingTeamId,
            playerId,
          })),
          skipDuplicates: true,
        });
      }

      const existingRegistrations = await tx.registration.findMany({
        where: { divisionId: division.id },
        select: { entryCode: true },
      });

      let nextSequence = 1;

      existingRegistrations.forEach((registration) => {
        const nextValue = parseExistingSequence(registration.entryCode) + 1;
        nextSequence = Math.max(nextSequence, nextValue);
      });

      const divisionMeta = new Map([[division.id, division]]);
      const entryCodes = assignEntryCodes(
        [{ divisionId: division.id, teamId: workingTeamId }],
        divisionMeta,
        new Map([[division.id, nextSequence]]),
      );
      const entryCode = entryCodes[0]?.entryCode;

      if (!entryCode) {
        throw Object.assign(new Error('Failed to generate entry code'), { status: 500 });
      }

      const createdRegistration = await tx.registration.create({
        data: {
          divisionId: division.id,
          teamId: workingTeamId,
          entryCode,
          seedNote: typeof seedNote === 'string' && seedNote.trim().length > 0 ? seedNote.trim() : null,
        },
        include: {
          team: {
            include: {
              players: {
                include: {
                  player: true,
                },
                orderBy: { createdAt: 'asc' },
              },
            },
          },
        },
      });

      return {
        division,
        registration: createdRegistration,
        teamName,
      };
    });

    const { division, registration, teamName } = result;

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'REGISTRATION_CREATE',
      resourceType: 'Registration',
      resourceId: registration.id,
      metadata: {
        divisionId: division.id,
        teamId: registration.teamId,
        entryCode: registration.entryCode,
      },
    });

    return res.status(201).json({
      id: registration.id,
      entryCode: registration.entryCode,
      seedNote: registration.seedNote,
      teamId: registration.teamId,
      teamName,
      players: registration.team.players.map((teamPlayer) => ({
        id: teamPlayer.playerId,
        firstName: teamPlayer.player.firstName,
        lastName: teamPlayer.player.lastName,
        dateOfBirth: teamPlayer.player.dateOfBirth,
        gender: teamPlayer.player.gender,
      })),
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error('Failed to create division registration', error);
    return res.status(500).json({ error: 'Failed to register team for division' });
  }
});

router.patch('/:slug/divisions/:divisionId/registrations/:registrationId', requireAuth, async (req, res) => {
  const { slug, divisionId, registrationId } = req.params;
  const { seedNote } = req.body ?? {};

  if (!slug || !divisionId || !registrationId) {
    return res.status(400).json({ error: 'slug, divisionId, and registrationId are required' });
  }

  if (seedNote === undefined) {
    return res.status(400).json({ error: 'seedNote is required to update registration' });
  }

  try {
    const registration = await prisma.registration.findFirst({
      where: {
        id: registrationId,
        divisionId,
        division: {
          tournament: {
            slug,
          },
        },
      },
      select: {
        id: true,
        divisionId: true,
        teamId: true,
      },
    });

    if (!registration) {
      return res.status(404).json({ error: `Registration ${registrationId} not found for division ${divisionId}` });
    }

    const updated = await prisma.registration.update({
      where: { id: registration.id },
      data: {
        seedNote: seedNote === null
          ? null
          : typeof seedNote === 'string' && seedNote.trim().length > 0
            ? seedNote.trim()
            : null,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'REGISTRATION_UPDATE',
      resourceType: 'Registration',
      resourceId: registration.id,
      metadata: {
        seedNote: updated.seedNote,
      },
    });

    return res.json({
      id: updated.id,
      entryCode: updated.entryCode,
      seedNote: updated.seedNote,
      teamId: updated.teamId,
      teamName: updated.team?.name ?? null,
    });
  } catch (error) {
    console.error('Failed to update registration', error);
    return res.status(500).json({ error: 'Failed to update registration' });
  }
});

router.delete('/:slug/divisions/:divisionId/registrations/:registrationId', requireAuth, async (req, res) => {
  const { slug, divisionId, registrationId } = req.params;
  const removeTeam = req.query.removeTeam === 'true';

  if (!slug || !divisionId || !registrationId) {
    return res.status(400).json({ error: 'slug, divisionId, and registrationId are required' });
  }

  try {
    const registration = await prisma.registration.findFirst({
      where: {
        id: registrationId,
        divisionId,
        division: {
          tournament: {
            slug,
          },
        },
      },
      select: {
        id: true,
        teamId: true,
        entryCode: true,
      },
    });

    if (!registration) {
      return res.status(404).json({ error: `Registration ${registrationId} not found for division ${divisionId}` });
    }

    await prisma.registration.delete({
      where: { id: registration.id },
    });

    if (removeTeam && registration.teamId) {
      const remainingRegistrations = await prisma.registration.count({
        where: { teamId: registration.teamId },
      });

      if (remainingRegistrations === 0) {
        await prisma.team.delete({
          where: { id: registration.teamId },
        });
      }
    }

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'REGISTRATION_DELETE',
      resourceType: 'Registration',
      resourceId: registration.id,
      metadata: {
        entryCode: registration.entryCode,
        teamId: registration.teamId,
      },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Failed to delete registration', error);
    return res.status(500).json({ error: 'Failed to delete registration' });
  }
});

/**
 * GET /api/v1/tournaments/:slug
 * Returns tournament details with associated courts.
 */
router.get('/:slug', async (req, res) => {
  const slug = req.params.slug?.trim();
  if (!slug) {
    return res.status(400).json({ error: 'slug is required' });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { slug },
      include: {
        courts: {
          orderBy: { label: 'asc' },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({ error: `Tournament with slug "${slug}" not found` });
    }

    return res.json(tournament);
  } catch (error) {
    console.error('Failed to fetch tournament', error);
    return res.status(500).json({ error: 'Failed to fetch tournament' });
  }
});

/**
 * PATCH /api/v1/tournaments/:slug
 * Updates tournament fields; ensures plannedCourtCount changes create missing courts.
 */
router.patch('/:slug', requireAuth, async (req, res) => {
  const slug = req.params.slug?.trim();
  if (!slug) {
    return res.status(400).json({ error: 'slug is required' });
  }

  const {
    validationErrors,
    trimmedName,
    trimmedSlug,
    trimmedLocation,
    normalizedCourtCount,
    normalizedStartDate,
    normalizedEndDate,
  } = validateTournamentPayload(req.body ?? {}, { requireSlug: false });

  if (validationErrors.length > 0) {
    return res.status(400).json({ errors: validationErrors });
  }

  const updateData = {
    name: trimmedName,
    location: trimmedLocation,
    plannedCourtCount: normalizedCourtCount,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
  };

  if (trimmedSlug) {
    updateData.slug = trimmedSlug;
  }

  try {
    const existingTournament = await prisma.tournament.findUnique({
      where: { slug },
      include: {
        courts: true,
      },
    });

    if (!existingTournament) {
      return res.status(404).json({ error: `Tournament with slug "${slug}" not found` });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedTournament = await tx.tournament.update({
        where: { slug },
        data: updateData,
      });

      const targetCourtCount =
        typeof normalizedCourtCount === 'number'
          ? normalizedCourtCount
          : existingTournament.plannedCourtCount;

      if (targetCourtCount && targetCourtCount > 0) {
        const currentCourts = await tx.court.findMany({
          where: { tournamentId: existingTournament.id },
        });

        const missingCourts = [];
        for (let index = 0; index < targetCourtCount; index += 1) {
          const label = String(index + 1);
          const alreadyExists = currentCourts.some((court) => court.label === label);
          if (!alreadyExists) {
            missingCourts.push({ label, tournamentId: existingTournament.id });
          }
        }

        if (missingCourts.length > 0) {
          await tx.court.createMany({ data: missingCourts, skipDuplicates: true });
        }
      }

      const resultingSlug = trimmedSlug || slug;

      return tx.tournament.findUnique({
        where: { slug: resultingSlug },
        include: {
          courts: {
            orderBy: { label: 'asc' },
          },
        },
      });
    });

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'TOURNAMENT_UPDATE',
      resourceType: 'Tournament',
      resourceId: result.id,
      metadata: {
        previousSlug: slug,
        updatedSlug: result.slug,
      },
    });

    return res.json(result);
  } catch (error) {
    if (error.code === 'P2002') {
      return res
        .status(409)
        .json({ error: `Tournament with slug "${trimmedSlug}" already exists` });
    }

    console.error('Failed to update tournament', error);
    return res.status(500).json({ error: 'Failed to update tournament' });
  }
});

router.delete('/:slug', requireAuth, async (req, res) => {
  const slug = req.params.slug?.trim();
  if (!slug) {
    return res.status(400).json({ error: 'slug is required' });
  }

  try {
    const existing = await prisma.tournament.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!existing) {
      return res.status(404).json({ error: `Tournament with slug "${slug}" not found` });
    }

    await prisma.tournament.delete({
      where: { id: existing.id },
    });

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'TOURNAMENT_DELETE',
      resourceType: 'Tournament',
      resourceId: existing.id,
      metadata: {
        slug,
        name: existing.name,
      },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Failed to delete tournament', error);
    return res.status(500).json({ error: 'Failed to delete tournament' });
  }
});

router.get('/:slug/summary', requireAuth, async (req, res) => {
  const slug = req.params.slug?.trim();

  if (!slug) {
    return res.status(400).json({ error: 'slug is required' });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { slug },
      include: {
        courts: {
          orderBy: { label: 'asc' },
        },
        divisions: {
          orderBy: { name: 'asc' },
          include: {
            brackets: {
              select: {
                id: true,
                type: true,
                locked: true,
                _count: {
                  select: {
                    matches: {
                      where: {
                        winnerId: null,
                      },
                    },
                  },
                },
              },
            },
            _count: {
              select: {
                brackets: true,
              },
            },
          },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({ error: `Tournament with slug "${slug}" not found` });
    }

    const [activeMatches, queueSnapshot] = await Promise.all([
      prisma.match.count({
        where: {
          winnerId: null,
          courtId: { not: null },
          bracket: {
            division: {
              tournament: {
                slug,
              },
            },
          },
        },
      }),
      getTournamentQueue({ slug }).catch(() => null),
    ]);

    const queueSummary = queueSnapshot
      ? {
          globalQueueCount: queueSnapshot.globalQueue.length,
          queuesByBracket: queueSnapshot.queues.map((entry) => ({
            bracketId: entry.bracketId,
            queueCount: entry.queue.length,
            queuePaused: entry.queuePaused,
          })),
        }
      : {
          globalQueueCount: 0,
          queuesByBracket: [],
        };

    const divisionSummaries = tournament.divisions.map((division) => {
      const totalBrackets = division._count.brackets;
      const unlockedCount = division.brackets.filter((bracket) => !bracket.locked).length;
      const pendingMatches = division.brackets.reduce((acc, bracket) => acc + bracket._count.matches, 0);

      return {
        id: division.id,
        name: division.name,
        bracketCount: totalBrackets,
        unlockedBrackets: unlockedCount,
        pendingMatches,
        brackets: division.brackets.map((bracket) => ({
          id: bracket.id,
          type: bracket.type,
          locked: bracket.locked,
          pendingMatches: bracket._count.matches,
        })),
      };
    });

    const summary = {
      slug: tournament.slug,
      tournamentId: tournament.id,
      name: tournament.name,
      location: tournament.location,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      totalDivisions: tournament.divisions.length,
      totalBrackets: tournament.divisions.reduce((acc, division) => acc + division._count.brackets, 0),
      totalCourts: tournament.courts.length,
      activeCourts: tournament.courts.filter((court) => court.active).length,
      activeMatches,
      queuedMatches: queueSummary.globalQueueCount,
      divisions: divisionSummaries,
      courts: tournament.courts.map((court) => ({
        id: court.id,
        label: court.label,
        active: court.active,
      })),
      queue: queueSnapshot,
    };

    return res.json(summary);
  } catch (error) {
    console.error('Failed to build tournament summary', error);
    return res.status(500).json({ error: 'Failed to build tournament summary' });
  }
});

router.get('/:slug/matches/:matchId', requireAuth, async (req, res) => {
  const { slug, matchId } = req.params;

  try {
    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
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
            type: true,
            config: true,
            division: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        team1: {
          include: {
            registrations: {
              where: {
                division: {
                  tournament: {
                    slug,
                  },
                },
              },
              select: {
                divisionId: true,
                entryCode: true,
              },
            },
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
        team2: {
          include: {
            registrations: {
              where: {
                division: {
                  tournament: {
                    slug,
                  },
                },
              },
              select: {
                divisionId: true,
                entryCode: true,
              },
            },
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
    });

    if (!match) {
      return res.status(404).json({ error: `Match ${matchId} not found for tournament "${slug}"` });
    }

    const mapTeamPayload = (team) => {
      if (!team) {
        return null;
      }

      const entryCode = team.registrations?.find?.((registration) => registration.divisionId === match.bracket.division.id)?.entryCode ?? null;

      return {
        id: team.id,
        name: team.name,
        entryCode,
        players: team.players?.map((teamPlayer) => {
          const player = teamPlayer.player ?? {};
          return {
            id: teamPlayer.playerId ?? player.id ?? null,
            firstName: player.firstName ?? null,
            lastName: player.lastName ?? null,
            dateOfBirth: player.dateOfBirth ?? null,
          };
        }) ?? [],
      };
    };

    return res.json({
      id: match.id,
      bracketId: match.bracket.id,
      bracketType: match.bracket.type,
      division: {
        id: match.bracket.division.id,
        name: match.bracket.division.name,
      },
      config: match.bracket.config ?? {},
      team1: mapTeamPayload(match.team1),
      team2: mapTeamPayload(match.team2),
      score: match.score ?? null,
      winnerId: match.winnerId,
    });
  } catch (error) {
    console.error('Failed to load match detail', error);
    return res.status(500).json({ error: 'Failed to load match detail' });
  }
});

function divisionCompositeKey(division) {
  return `${division.name}|${division.level}|${division.ageGroup}|${division.format}`;
}

router.get('/:slug/export', requireAuth, async (req, res) => {
  const slug = req.params.slug?.trim();

  if (!slug) {
    return res.status(400).json({ error: 'slug is required' });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { slug },
      select: {
        id: true,
        divisions: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            level: true,
            ageGroup: true,
            format: true,
            registrations: {
              orderBy: { createdAt: 'asc' },
              select: {
                seedNote: true,
                team: {
                  select: {
                    name: true,
                    players: {
                      orderBy: { createdAt: 'asc' },
                      select: {
                        player: {
                          select: {
                            firstName: true,
                            lastName: true,
                            dateOfBirth: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({ error: `Tournament with slug "${slug}" not found` });
    }

    const { csv, rowCount } = buildTournamentExportCsv(tournament.divisions ?? []);

    const sanitizedSlug = slug.replace(/[^a-z0-9_-]+/gi, '-');
    const filename = `${sanitizedSlug || 'tournament'}-registrations.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'TOURNAMENT_EXPORT',
      resourceType: 'Tournament',
      resourceId: tournament.id,
      metadata: {
        rowCount,
      },
    });

    return res.status(200).send(csv);
  } catch (error) {
    console.error('Failed to export tournament data', error);
    return res.status(500).json({ error: 'Failed to export CSV' });
  }
});

router.post('/:slug/import', requireAuth, async (req, res) => {
  const slug = req.params.slug?.trim();
  if (!slug) {
    return res.status(400).json({ error: 'slug is required' });
  }

  const csv = req.body?.csv;
  if (!csv || typeof csv !== 'string' || csv.trim().length === 0) {
    return res.status(400).json({ error: 'csv string is required' });
  }

  let parsed;
  try {
    parsed = parseConsolidatedCsv(csv);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  if (parsed.errors.length > 0) {
    return res.status(422).json({ errors: parsed.errors });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { slug },
    });

    if (!tournament) {
      return res.status(404).json({ error: `Tournament with slug "${slug}" not found` });
    }

    const summary = await prisma.$transaction(async (tx) => {
      const divisionMeta = new Map();
      const divisionKeyToRecord = new Map();
      let divisionsCreated = 0;

      if (parsed.divisions.length > 0) {
        const existingDivisions = await tx.division.findMany({
          where: {
            tournamentId: tournament.id,
            OR: parsed.divisions.map((division) => ({
              name: division.name,
              level: division.level,
              ageGroup: division.ageGroup,
              format: division.format,
            })),
          },
        });

        existingDivisions.forEach((division) => {
          divisionKeyToRecord.set(divisionCompositeKey(division), division);
        });

        for (const division of parsed.divisions) {
          const key = divisionCompositeKey(division);
          if (!divisionKeyToRecord.has(key)) {
            const created = await tx.division.create({
              data: {
                name: division.name,
                level: division.level,
                ageGroup: division.ageGroup,
                format: division.format,
                tournamentId: tournament.id,
              },
            });
            divisionKeyToRecord.set(key, created);
            divisionsCreated += 1;
          }

          const record = divisionKeyToRecord.get(key);
          divisionMeta.set(division.id, record);
        }
      }

      const playerKey = (player) =>
        `${player.firstName.toLowerCase()}|${player.lastName.toLowerCase()}|${player.dateOfBirth ?? ''}`;

      const playerIdMap = new Map();
      let playersCreated = 0;

      if (parsed.players.length > 0) {
        const playerConditions = parsed.players.map((player) => ({
          firstName: player.firstName,
          lastName: player.lastName,
          dateOfBirth: player.dateOfBirth ? new Date(player.dateOfBirth) : null,
        }));

        const existingPlayers =
          playerConditions.length > 0
            ? await tx.player.findMany({
                where: {
                  OR: playerConditions,
                },
              })
            : [];

        const existingPlayerMap = new Map(
          existingPlayers.map((player) => [
            playerKey({
              firstName: player.firstName,
              lastName: player.lastName,
              dateOfBirth: player.dateOfBirth ? player.dateOfBirth.toISOString().slice(0, 10) : null,
            }),
            player.id,
          ]),
        );

        for (const player of parsed.players) {
          const key = playerKey(player);
          if (!existingPlayerMap.has(key)) {
            const created = await tx.player.create({
              data: {
                firstName: player.firstName,
                lastName: player.lastName,
                dateOfBirth: player.dateOfBirth ? new Date(player.dateOfBirth) : null,
              },
            });
            existingPlayerMap.set(key, created.id);
            playersCreated += 1;
          }
          playerIdMap.set(player.id, existingPlayerMap.get(key));
        }
      }

      const teamIdMap = new Map();
      let teamsCreated = 0;

      for (const team of parsed.teams) {
        const playerIds = team.playerIds.map((id) => playerIdMap.get(id)).filter(Boolean);

        const createdTeam = await tx.team.create({
          data: {
            name: team.name,
          },
        });

        teamsCreated += 1;
        teamIdMap.set(team.id, createdTeam.id);

        if (playerIds.length > 0) {
          await tx.teamPlayer.createMany({
            data: playerIds.map((playerId) => ({
              teamId: createdTeam.id,
              playerId,
            })),
            skipDuplicates: true,
          });
        }
      }

      const divisionIds = Array.from(new Set([...divisionMeta.values()].map((division) => division.id)));

      const existingRegistrations =
        divisionIds.length > 0
          ? await tx.registration.findMany({
              where: { divisionId: { in: divisionIds } },
              select: { divisionId: true, entryCode: true },
            })
          : [];

      const nextSequence = new Map();

      existingRegistrations.forEach((registration) => {
        const next = parseExistingSequence(registration.entryCode) + 1;
        const current = nextSequence.get(registration.divisionId) ?? 1;
        nextSequence.set(registration.divisionId, Math.max(current, next));
      });

      const registrationsWithCodes = assignEntryCodes(parsed.registrations, divisionMeta, nextSequence);

      let registrationsCreated = 0;

      for (const registration of registrationsWithCodes) {
        const divisionRecord = divisionMeta.get(registration.divisionId);
        const teamId = teamIdMap.get(registration.teamId);

        await tx.registration.create({
          data: {
            divisionId: divisionRecord.id,
            teamId,
            entryCode: registration.entryCode,
            seedNote: registration.seedNote,
          },
        });

        registrationsCreated += 1;
      }

      return {
        divisionsCreated,
        playersCreated,
        teamsCreated,
        registrationsCreated,
        entryCodes: registrationsWithCodes.map((registration) => ({
          divisionId: divisionMeta.get(registration.divisionId).id,
          entryCode: registration.entryCode,
        })),
      };
    });

    await recordAuditLog({
      actor: req.user?.email ?? 'unknown',
      action: 'TOURNAMENT_IMPORT',
      resourceType: 'Tournament',
      resourceId: tournament.id,
      metadata: summary,
    });

    return res.status(201).json(summary);
  } catch (error) {
    console.error('Failed to import tournament data', error);
    return res.status(500).json({ error: 'Failed to import CSV' });
  }
});

module.exports = router;
