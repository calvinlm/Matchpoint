import { z } from 'zod';
import { apiClient } from './client';
import { matchScoreSchema } from './brackets';

const matchPlayerSchema = z.object({
  id: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
});

const matchPrintTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  entryCode: z.string().nullable(),
  players: z.array(matchPlayerSchema),
});

const matchDetailSchema = z.object({
  id: z.string(),
  bracketId: z.string(),
  bracketType: z.string(),
  division: z.object({
    id: z.string(),
    name: z.string(),
  }),
  config: z.record(z.any()).default({}),
  team1: matchPrintTeamSchema.nullable(),
  team2: matchPrintTeamSchema.nullable(),
  score: matchScoreSchema.nullable(),
  winnerId: z.string().nullable(),
});

export type MatchPrintTeam = z.infer<typeof matchPrintTeamSchema>;
export type MatchDetail = z.infer<typeof matchDetailSchema>;

export function getMatchDetail(slug: string, matchId: string, token?: string) {
  return apiClient
    .get<unknown>(`/api/v1/tournaments/${slug}/matches/${matchId}`, token)
    .then((payload) => matchDetailSchema.parse(payload));
}
