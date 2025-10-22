const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

function findEntryCode(team, divisionId) {
  if (!team || !Array.isArray(team.registrations)) {
    return null;
  }

  const registration = team.registrations.find((entry) => entry.divisionId === divisionId);
  return registration?.entryCode ?? null;
}

function mapStandingRow(standing, divisionId) {
  if (!standing) {
    return null;
  }

  const registrations = standing.team?.registrations ?? [];
  const registration = registrations.find((entry) => entry.divisionId === divisionId);

  return {
    teamId: standing.teamId,
    teamName: standing.team?.name ?? 'Unknown Team',
    entryCode: registration?.entryCode ?? null,
    wins: standing.wins,
    losses: standing.losses,
    pointsFor: standing.pointsFor,
    pointsAgainst: standing.pointsAgainst,
    quotient: Number(standing.quotient ?? 0),
    rank: standing.rank ?? null,
  };
}

router.get('/:slug/standings', async (req, res) => {
  const slug = req.params.slug?.trim();

  if (!slug) {
    return res.status(400).json({ error: 'slug is required' });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        divisions: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            level: true,
            ageGroup: true,
            format: true,
            brackets: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                type: true,
                standings: {
                  orderBy: { rank: 'asc' },
                  include: {
                    team: {
                      select: {
                        id: true,
                        name: true,
                        registrations: {
                          select: {
                            divisionId: true,
                            entryCode: true,
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

    const divisions = tournament.divisions.map((division) => ({
      id: division.id,
      name: division.name,
      level: division.level,
      ageGroup: division.ageGroup,
      format: division.format,
      brackets: division.brackets.map((bracket) => ({
        id: bracket.id,
        type: bracket.type,
        standings: bracket.standings
          .map((standing) => mapStandingRow(standing, division.id))
          .filter((row) => row && row.rank != null),
      })),
    }));

    res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=10');
    return res.json({
      slug,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      updatedAt: new Date().toISOString(),
      divisions,
    });
  } catch (error) {
    console.error('Failed to load public standings', error);
    return res.status(500).json({ error: 'Failed to load public standings' });
  }
});

router.get('/:slug/players', async (req, res) => {
  const slug = req.params.slug?.trim();

  if (!slug) {
    return res.status(400).json({ error: 'slug is required' });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        divisions: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            level: true,
            ageGroup: true,
            format: true,
            registrations: {
              orderBy: { entryCode: 'asc' },
              select: {
                entryCode: true,
                seedNote: true,
                team: {
                  select: {
                    id: true,
                    name: true,
                    players: {
                      orderBy: { createdAt: 'asc' },
                      include: {
                        player: true,
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

    const divisions = tournament.divisions.map((division) => ({
      id: division.id,
      name: division.name,
      level: division.level,
      ageGroup: division.ageGroup,
      format: division.format,
      teams: division.registrations.map((registration) => ({
        teamId: registration.team?.id ?? 'unknown',
        teamName: registration.team?.name ?? 'Unknown Team',
        entryCode: registration.entryCode,
        seedNote: registration.seedNote ?? null,
        players:
          registration.team?.players?.map((teamPlayer) => ({
            id: teamPlayer.playerId ?? teamPlayer.player?.id ?? null,
            firstName: teamPlayer.player?.firstName ?? null,
            lastName: teamPlayer.player?.lastName ?? null,
            dateOfBirth: teamPlayer.player?.dateOfBirth ?? null,
          })) ?? [],
      })),
    }));

    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=30');
    return res.json({
      slug,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      updatedAt: new Date().toISOString(),
      divisions,
    });
  } catch (error) {
    console.error('Failed to load public players', error);
    return res.status(500).json({ error: 'Failed to load public players' });
  }
});

router.get('/:slug/table', async (req, res) => {
  const slug = req.params.slug?.trim();

  if (!slug) {
    return res.status(400).json({ error: 'slug is required' });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        divisions: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            brackets: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                type: true,
                divisionId: true,
              },
            },
          },
        },
        courts: {
          orderBy: { label: 'asc' },
          select: {
            id: true,
            label: true,
            active: true,
          },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({ error: `Tournament with slug "${slug}" not found` });
    }

    const brackets = await prisma.bracket.findMany({
      where: { division: { tournamentId: tournament.id } },
      include: {
        matches: {
          where: {
            winnerId: null,
          },
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
            court: true,
          },
        },
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

    const courts = await prisma.court.findMany({
      where: { tournamentId: tournament.id },
      include: {
        matches: {
          where: {
            winnerId: null,
          },
          include: {
            bracket: {
              include: {
                division: true,
              },
            },
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
        },
      },
      orderBy: { label: 'asc' },
    });

    const queueEntries = brackets.map((bracket) => {
      const queueMatches = bracket.matches
        .filter((match) => !match.courtId)
        .sort((a, b) => {
          const startA = a.startTime ? new Date(a.startTime).getTime() : Number.POSITIVE_INFINITY;
          const startB = b.startTime ? new Date(b.startTime).getTime() : Number.POSITIVE_INFINITY;
          if (startA !== startB) {
            return startA - startB;
          }
          return a.createdAt.getTime() - b.createdAt.getTime();
        })
        .map((match) => {
          const mapTeam = (team) => {
            if (!team) {
              return null;
            }
            return {
              id: team.id,
              name: team.name,
              entryCode: findEntryCode(team, bracket.divisionId),
            };
          };

          return {
            id: match.id,
            team1: mapTeam(match.team1),
            team2: mapTeam(match.team2),
            startTime: match.startTime ?? null,
            createdAt: match.createdAt.toISOString(),
          };
        });

      return {
        bracketId: bracket.id,
        bracketType: bracket.type,
        divisionId: bracket.divisionId,
        divisionName: bracket.division.name,
        queue: queueMatches,
      };
    });

    const courtEntries = courts.map((court) => {
      const activeMatch = court.matches[0];
      const mapTeam = (team, divisionId) => {
        if (!team) {
          return null;
        }
        return {
          id: team.id,
          name: team.name,
          entryCode: findEntryCode(team, divisionId),
        };
      };

      return {
        id: court.id,
        label: court.label,
        active: court.active,
        assignment: activeMatch
          ? {
              id: activeMatch.id,
              bracketId: activeMatch.bracketId,
              divisionName: activeMatch.bracket.division.name,
              bracketType: activeMatch.bracket.type,
              team1: mapTeam(activeMatch.team1, activeMatch.bracket.division?.id),
              team2: mapTeam(activeMatch.team2, activeMatch.bracket.division?.id),
              startTime: activeMatch.startTime ?? null,
            }
          : null,
      };
    });

    const divisions = tournament.divisions.map((division) => ({
      id: division.id,
      name: division.name,
      brackets: queueEntries
        .filter((entry) => entry.divisionId === division.id)
        .map((entry) => ({
          id: entry.bracketId,
          type: entry.bracketType,
          queue: entry.queue,
        })),
    }));

    res.set('Cache-Control', 'public, max-age=7, stale-while-revalidate=7');
    return res.json({
      slug,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      updatedAt: new Date().toISOString(),
      courts: courtEntries,
      divisions,
    });
  } catch (error) {
    console.error('Failed to load public queue table', error);
    return res.status(500).json({ error: 'Failed to load public queue table' });
  }
});

router.get('/:slug/brackets', async (req, res) => {
  const slug = req.params.slug?.trim();

  if (!slug) {
    return res.status(400).json({ error: 'slug is required' });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        divisions: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            brackets: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                type: true,
                locked: true,
                config: true,
                seedings: {
                  orderBy: { seed: 'asc' },
                  include: {
                    team: {
                      select: {
                        id: true,
                        name: true,
                        registrations: {
                          select: {
                            divisionId: true,
                            entryCode: true,
                          },
                        },
                      },
                    },
                  },
                },
                matches: {
                  orderBy: [{ createdAt: 'asc' }],
                  include: {
                    team1: {
                      include: {
                        registrations: {
                          select: {
                            divisionId: true,
                            entryCode: true,
                          },
                        },
                      },
                    },
                    team2: {
                      include: {
                        registrations: {
                          select: {
                            divisionId: true,
                            entryCode: true,
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

    const divisions = tournament.divisions.map((division) => ({
      id: division.id,
      name: division.name,
      brackets: division.brackets.map((bracket) => ({
        id: bracket.id,
        type: bracket.type,
        locked: bracket.locked,
        config: bracket.config ?? {},
        seedings: bracket.seedings.map((seeding) => ({
          teamId: seeding.teamId,
          teamName: seeding.team?.name ?? 'Unknown Team',
          entryCode: findEntryCode(seeding.team, division.id),
          seed: seeding.seed,
        })),
        matches: bracket.matches.map((match) => ({
          id: match.id,
          team1: match.team1
            ? {
                id: match.team1.id,
                name: match.team1.name,
                entryCode: findEntryCode(match.team1, division.id),
              }
            : null,
          team2: match.team2
            ? {
                id: match.team2.id,
                name: match.team2.name,
                entryCode: findEntryCode(match.team2, division.id),
              }
            : null,
          winnerId: match.winnerId,
          score: match.score ?? null,
          status: match.winnerId ? 'COMPLETED' : 'PENDING',
        })),
      })),
    }));

    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=30');
    return res.json({
      slug,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      updatedAt: new Date().toISOString(),
      divisions,
    });
  } catch (error) {
    console.error('Failed to load public brackets', error);
    return res.status(500).json({ error: 'Failed to load public brackets' });
  }
});

module.exports = router;
