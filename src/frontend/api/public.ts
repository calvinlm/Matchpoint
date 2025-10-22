import { z } from 'zod';
import { apiClient } from './client';

const standingRowSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  entryCode: z.string().nullable(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  pointsFor: z.number().int().nonnegative(),
  pointsAgainst: z.number().int().nonnegative(),
  quotient: z.number(),
  rank: z.number().int().positive(),
});

const bracketStandingsSchema = z.object({
  id: z.string(),
  type: z.string(),
  standings: z.array(standingRowSchema),
});

const divisionStandingsSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.string(),
  ageGroup: z.string(),
  format: z.string(),
  brackets: z.array(bracketStandingsSchema),
});

const tournamentStandingsSchema = z.object({
  slug: z.string(),
  tournamentId: z.string(),
  tournamentName: z.string(),
  updatedAt: z.string(),
  divisions: z.array(divisionStandingsSchema),
});

const publicPlayerSchema = z.object({
  id: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
});

const publicTeamSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  entryCode: z.string().nullable(),
  seedNote: z.string().nullable(),
  players: z.array(publicPlayerSchema),
});

const publicDivisionPlayersSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.string(),
  ageGroup: z.string(),
  format: z.string(),
  teams: z.array(publicTeamSchema),
});

const tournamentPlayersSchema = z.object({
  slug: z.string(),
  tournamentId: z.string(),
  tournamentName: z.string(),
  updatedAt: z.string(),
  divisions: z.array(publicDivisionPlayersSchema),
});

export type PublicStandingRow = z.infer<typeof standingRowSchema>;
export type PublicBracketStandings = z.infer<typeof bracketStandingsSchema>;
export type PublicDivisionStandings = z.infer<typeof divisionStandingsSchema>;
export type PublicTournamentStandings = z.infer<typeof tournamentStandingsSchema>;
export type PublicPlayer = z.infer<typeof publicPlayerSchema>;
export type PublicTeam = z.infer<typeof publicTeamSchema>;
export type PublicDivisionPlayers = z.infer<typeof publicDivisionPlayersSchema>;
export type PublicTournamentPlayers = z.infer<typeof tournamentPlayersSchema>;
const publicQueueMatchSchema = z.object({
  id: z.string(),
  team1: z
    .object({
      id: z.string(),
      name: z.string(),
      entryCode: z.string().nullable(),
    })
    .nullable(),
  team2: z
    .object({
      id: z.string(),
      name: z.string(),
      entryCode: z.string().nullable(),
    })
    .nullable(),
  startTime: z.string().nullable(),
  createdAt: z.string(),
});

const publicBracketQueueSchema = z.object({
  id: z.string(),
  type: z.string(),
  queue: z.array(publicQueueMatchSchema),
});

const publicCourtEntrySchema = z.object({
  id: z.string(),
  label: z.string(),
  active: z.boolean(),
  assignment: z
    .object({
      id: z.string(),
      bracketId: z.string(),
      divisionName: z.string(),
      bracketType: z.string(),
      team1: z
        .object({
          id: z.string(),
          name: z.string(),
          entryCode: z.string().nullable(),
        })
        .nullable(),
      team2: z
        .object({
          id: z.string(),
          name: z.string(),
          entryCode: z.string().nullable(),
        })
        .nullable(),
      startTime: z.string().nullable(),
    })
    .nullable(),
});

const publicDivisionQueueSchema = z.object({
  id: z.string(),
  name: z.string(),
  brackets: z.array(publicBracketQueueSchema),
});

const publicTournamentQueueSchema = z.object({
  slug: z.string(),
  tournamentId: z.string(),
  tournamentName: z.string(),
  updatedAt: z.string(),
  courts: z.array(publicCourtEntrySchema),
  divisions: z.array(publicDivisionQueueSchema),
});

export type PublicQueueMatch = z.infer<typeof publicQueueMatchSchema>;
export type PublicBracketQueue = z.infer<typeof publicBracketQueueSchema>;
export type PublicCourtEntry = z.infer<typeof publicCourtEntrySchema>;
export type PublicDivisionQueue = z.infer<typeof publicDivisionQueueSchema>;
export type PublicTournamentQueue = z.infer<typeof publicTournamentQueueSchema>;

const publicBracketTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  entryCode: z.string().nullable(),
});

const publicBracketMatchSchema = z.object({
  id: z.string(),
  team1: publicBracketTeamSchema.nullable(),
  team2: publicBracketTeamSchema.nullable(),
  winnerId: z.string().nullable(),
  score: z.any().nullable(),
  status: z.enum(['PENDING', 'COMPLETED']),
});

const publicBracketSeedSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  entryCode: z.string().nullable(),
  seed: z.number().int().positive(),
});

const publicBracketSchema = z.object({
  id: z.string(),
  type: z.string(),
  locked: z.boolean(),
  config: z.record(z.any()),
  seedings: z.array(publicBracketSeedSchema),
  matches: z.array(publicBracketMatchSchema),
});

const publicDivisionBracketSchema = z.object({
  id: z.string(),
  name: z.string(),
  brackets: z.array(publicBracketSchema),
});

const publicTournamentBracketsSchema = z.object({
  slug: z.string(),
  tournamentId: z.string(),
  tournamentName: z.string(),
  updatedAt: z.string(),
  divisions: z.array(publicDivisionBracketSchema),
});

export type PublicBracketTeam = z.infer<typeof publicBracketTeamSchema>;
export type PublicBracketMatch = z.infer<typeof publicBracketMatchSchema>;
export type PublicBracketSeed = z.infer<typeof publicBracketSeedSchema>;
export type PublicBracket = z.infer<typeof publicBracketSchema>;
export type PublicDivisionBracket = z.infer<typeof publicDivisionBracketSchema>;
export type PublicTournamentBrackets = z.infer<typeof publicTournamentBracketsSchema>;

export function getPublicStandings(slug: string) {
  return apiClient
    .get<unknown>(`/api/v1/public/${slug}/standings`)
    .then((payload) => tournamentStandingsSchema.parse(payload));
}

export function getPublicPlayers(slug: string) {
  return apiClient
    .get<unknown>(`/api/v1/public/${slug}/players`)
    .then((payload) => tournamentPlayersSchema.parse(payload));
}

export function getPublicQueueTable(slug: string) {
  return apiClient
    .get<unknown>(`/api/v1/public/${slug}/table`)
    .then((payload) => publicTournamentQueueSchema.parse(payload));
}

export function getPublicBrackets(slug: string) {
  return apiClient
    .get<unknown>(`/api/v1/public/${slug}/brackets`)
    .then((payload) => publicTournamentBracketsSchema.parse(payload));
}
