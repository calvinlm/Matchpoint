import { apiClient } from './client';
import { z } from 'zod';

const roundSchema = z.object({
  name: z.string(),
  matchCount: z.number().int().positive(),
});

const bracketConfigSchema = z.object({
  bestOf: z.number().int().positive(),
  winBy2: z.boolean(),
  rounds: z.array(roundSchema).optional(),
  finalsReset: z.boolean().optional(),
  groups: z.number().int().positive().optional(),
  groupSize: z.number().int().positive().optional(),
});

const bracketSchema = z.object({
  id: z.string(),
  type: z.string(),
  divisionId: z.string(),
  config: bracketConfigSchema,
  locked: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  seedings: z.array(z.object({ teamId: z.string(), seed: z.number().int().positive() })).optional(),
});

const playerSummarySchema = z.object({
  id: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
});

const matchTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  entryCode: z.string().nullable(),
  players: z.array(playerSummarySchema),
});

const conflictTeamSchema = matchTeamSchema;

const matchConflictSchema = z.object({
  matchId: z.string(),
  type: z.enum(['TEAM', 'PLAYER']),
  sharedTeamIds: z.array(z.string()).optional(),
  sharedPlayerIds: z.array(z.string()).optional(),
  sharedPlayers: z.array(playerSummarySchema).default([]),
  opponents: z.array(conflictTeamSchema).default([]),
  opponentPlayers: z.array(playerSummarySchema).default([]),
});

const scoreGameSchema = z.object({
  team1: z.number().int().nonnegative(),
  team2: z.number().int().nonnegative(),
});

const matchScoreSchema = z.object({
  games: z.array(scoreGameSchema),
  bestOf: z.number().int().positive(),
  winBy2: z.boolean(),
  completedAt: z.string(),
});

const matchSummarySchema = z.object({
  id: z.string(),
  bracketId: z.string(),
  divisionId: z.string(),
  courtId: z.string().nullable(),
  startTime: z.string().nullable(),
  priority: z.number().int(),
  status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED', 'RETIRED']),
  team1: matchTeamSchema.nullable(),
  team2: matchTeamSchema.nullable(),
  score: matchScoreSchema.nullable().optional(),
  conflicts: z.array(matchConflictSchema).default([]),
});

const bracketScheduleSchema = z.object({
  bracketId: z.string(),
  divisionId: z.string(),
  queuePaused: z.boolean(),
  courts: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      active: z.boolean(),
      assignment: matchSummarySchema.nullable(),
    }),
  ),
  queue: z.array(matchSummarySchema),
});

const bracketQueueSchema = z.object({
  bracketId: z.string(),
  bracketType: z.string(),
  divisionId: z.string(),
  divisionName: z.string(),
  queuePaused: z.boolean(),
  queue: z.array(matchSummarySchema),
});

const globalQueueItemSchema = matchSummarySchema.extend({
  divisionName: z.string(),
  bracketType: z.string(),
  queuePaused: z.boolean(),
});

const tournamentQueueSchema = z.object({
  slug: z.string(),
  tournamentId: z.string(),
  tournamentName: z.string(),
  updatedAt: z.string(),
  queues: z.array(bracketQueueSchema),
  globalQueue: z.array(globalQueueItemSchema),
});

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
  bracketId: z.string(),
  type: z.string(),
  standings: z.array(standingRowSchema),
});

const teamWithSeedSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  entryCode: z.string().nullable(),
  seed: z.number().int().positive().nullable(),
  players: z.array(
    z.object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      dateOfBirth: z.string().nullable(),
    }),
  ),
});

export type BracketConfig = z.infer<typeof bracketConfigSchema>;
export type Bracket = z.infer<typeof bracketSchema>;
export type PlayerSummary = z.infer<typeof playerSummarySchema>;
export type MatchConflict = z.infer<typeof matchConflictSchema>;
export type MatchSummary = z.infer<typeof matchSummarySchema>;
export type BracketSchedule = z.infer<typeof bracketScheduleSchema>;
export type BracketQueue = z.infer<typeof bracketQueueSchema>;
export type TournamentQueue = z.infer<typeof tournamentQueueSchema>;
export type TeamWithSeed = z.infer<typeof teamWithSeedSchema>;
export type MatchScore = z.infer<typeof matchScoreSchema>;
export type BracketStandingRow = z.infer<typeof standingRowSchema>;
export type BracketStandings = z.infer<typeof bracketStandingsSchema>;
export { matchSummarySchema, matchScoreSchema };

export interface TeamWithSeed {
  teamId: string;
  teamName: string;
  entryCode: string | null;
  seed: number | null;
  players: Array<{
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
  }>;
}

export interface CreateBracketPayload {
  type: string;
  config: BracketConfig;
  locked?: boolean;
}

export interface UpdateBracketPayload {
  config?: BracketConfig;
  locked?: boolean;
}

export interface ApplySeedingPayload {
  entries: Array<{ teamId: string; seed: number }>;
}

export interface UpdateMatchAssignmentPayload {
  courtId: string | null;
  startTime?: string | null;
}

export interface BulkReschedulePayload {
  updates: Array<{ matchId: string; startTime?: string | null; courtId?: string | null; priority?: number | null }>;
}

export interface RetireMatchesPayload {
  matchIds: string[];
}

export interface SwapMatchesPayload {
  matchAId: string;
  matchBId: string;
}

export interface ReorderQueuePayload {
  order: string[];
}

const matchScoreResultSchema = z.object({
  id: z.string(),
  bracketId: z.string(),
  divisionId: z.string(),
  winnerId: z.string(),
  status: z.literal('COMPLETED'),
  score: matchScoreSchema,
});

export interface SubmitMatchScorePayload {
  games: Array<{
    team1: number;
    team2: number;
  }>;
}

export type SubmitMatchScoreResult = z.infer<typeof matchScoreResultSchema>;

const baseUrl = '/api/v1';

export function listBrackets(slug: string, token?: string) {
  return apiClient
    .get<unknown>(`${baseUrl}/tournaments/${slug}/brackets`, token)
    .then((payload) => z.array(bracketSchema).parse(payload));
}

export function createBracket(slug: string, divisionId: string, payload: CreateBracketPayload, token?: string) {
  return apiClient
    .post<unknown>(
      `${baseUrl}/tournaments/${slug}/divisions/${divisionId}/brackets`,
      payload,
      token,
    )
    .then((payload) => bracketSchema.parse(payload));
}

export function updateBracket(slug: string, bracketId: string, payload: UpdateBracketPayload, token?: string) {
  return apiClient
    .patch<unknown>(
      `${baseUrl}/tournaments/${slug}/brackets/${bracketId}`,
      payload,
      token,
    )
    .then((payload) => bracketSchema.parse(payload));
}

export function deleteBracket(slug: string, bracketId: string, token?: string) {
  return apiClient.delete<void>(`${baseUrl}/tournaments/${slug}/brackets/${bracketId}`, token);
}

export function applySeeding(slug: string, bracketId: string, payload: ApplySeedingPayload, token?: string) {
  return apiClient
    .patch<unknown>(
      `${baseUrl}/tournaments/${slug}/brackets/${bracketId}/seeding`,
      payload,
      token,
    )
    .then((payload) =>
      z
        .object({
          bracketId: z.string(),
          entries: z.array(z.object({ teamId: z.string(), seed: z.number().int().positive() })),
        })
        .parse(payload),
    );
}

export function getBracketSchedule(slug: string, bracketId: string, token?: string) {
  return apiClient
    .get<unknown>(`${baseUrl}/tournaments/${slug}/brackets/${bracketId}/schedule`, token)
    .then((payload) => bracketScheduleSchema.parse(payload));
}

export function updateMatchAssignment(
  slug: string,
  bracketId: string,
  matchId: string,
  payload: UpdateMatchAssignmentPayload,
  token?: string,
) {
  return apiClient
    .patch<unknown>(
      `${baseUrl}/tournaments/${slug}/brackets/${bracketId}/matches/${matchId}/assignment`,
      payload,
      token,
    )
    .then((response) => matchSummarySchema.parse(response));
}

export function rescheduleMatches(slug: string, bracketId: string, payload: BulkReschedulePayload, token?: string) {
  return apiClient
    .patch<unknown>(`${baseUrl}/tournaments/${slug}/brackets/${bracketId}/schedule/reschedule`, payload, token)
    .then((response) =>
      z
        .object({
          matches: z.array(matchSummarySchema),
        })
        .parse(response),
    );
}

export function retireMatches(slug: string, bracketId: string, payload: RetireMatchesPayload, token?: string) {
  return apiClient
    .post<unknown>(`${baseUrl}/tournaments/${slug}/brackets/${bracketId}/matches/retire`, payload, token)
    .then((response) =>
      z
        .object({
          matches: z.array(matchSummarySchema),
        })
        .parse(response),
    );
}

export function swapMatches(slug: string, bracketId: string, payload: SwapMatchesPayload, token?: string) {
  return apiClient
    .post<unknown>(`${baseUrl}/tournaments/${slug}/brackets/${bracketId}/matches/swap`, payload, token)
    .then((response) =>
      z
        .object({
          matches: z.array(matchSummarySchema),
        })
        .parse(response),
    );
}

export function setQueuePause(slug: string, bracketId: string, paused: boolean, token?: string) {
  return apiClient
    .patch<unknown>(`${baseUrl}/tournaments/${slug}/brackets/${bracketId}/queue`, { paused }, token)
    .then((response) =>
      z
        .object({
          bracketId: z.string(),
          queuePaused: z.boolean(),
        })
        .parse(response),
    );
}

export function reorderQueue(slug: string, bracketId: string, payload: ReorderQueuePayload, token?: string) {
  return apiClient
    .patch<unknown>(`${baseUrl}/tournaments/${slug}/brackets/${bracketId}/queue/reorder`, payload, token)
    .then((response) =>
      z
        .object({
          matches: z.array(matchSummarySchema),
        })
        .parse(response),
    );
}

export function getTournamentQueue(slug: string, token?: string) {
  return apiClient
    .get<unknown>(`${baseUrl}/tournaments/${slug}/queue`, token)
    .then((payload) => tournamentQueueSchema.parse(payload));
}

export function listDivisionTeams(slug: string, divisionId: string, bracketId?: string, token?: string) {
  const query = bracketId ? `?bracketId=${encodeURIComponent(bracketId)}` : '';
  return apiClient
    .get<unknown>(`${baseUrl}/tournaments/${slug}/divisions/${divisionId}/teams${query}`, token)
    .then((payload) =>
      z
        .object({
          teams: z.array(teamWithSeedSchema),
        })
        .parse(payload),
    );
}

export function submitMatchScore(
  slug: string,
  bracketId: string,
  matchId: string,
  payload: SubmitMatchScorePayload,
  token?: string,
) {
  return apiClient
    .patch<unknown>(
      `${baseUrl}/tournaments/${slug}/brackets/${bracketId}/matches/${matchId}/score`,
      payload,
      token,
    )
    .then((response) => matchScoreResultSchema.parse(response));
}

export function getBracketStandings(slug: string, bracketId: string, token?: string) {
  return apiClient
    .get<unknown>(`${baseUrl}/tournaments/${slug}/brackets/${bracketId}/standings`, token)
    .then((payload) => bracketStandingsSchema.parse(payload));
}
