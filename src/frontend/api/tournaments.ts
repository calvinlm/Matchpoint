import { z } from 'zod';
import { apiClient } from './client';
import { matchSummarySchema } from './brackets';

const baseUrl = '/api/v1';

const tournamentListItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  location: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  plannedCourtCount: z.number().int().nullable(),
  divisionCount: z.number().int().nonnegative(),
  courtCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const tournamentsListSchema = z.object({
  tournaments: z.array(tournamentListItemSchema),
});

const tournamentCourtSchema = z.object({
  id: z.string(),
  label: z.string(),
  active: z.boolean(),
  tournamentId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const tournamentDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  location: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  plannedCourtCount: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  courts: z.array(tournamentCourtSchema),
});

const bracketOverviewSchema = z.object({
  id: z.string(),
  type: z.string(),
  locked: z.boolean(),
  pendingMatches: z.number().int().nonnegative(),
});

const divisionOverviewSchema = z.object({
  id: z.string(),
  name: z.string(),
  bracketCount: z.number().int().nonnegative(),
  unlockedBrackets: z.number().int().nonnegative(),
  pendingMatches: z.number().int().nonnegative(),
  brackets: z.array(bracketOverviewSchema),
});

const courtSchema = z.object({
  id: z.string(),
  label: z.string(),
  active: z.boolean(),
});

const queueSnapshotSchema = z
  .object({
    slug: z.string(),
    tournamentId: z.string(),
    tournamentName: z.string().optional(),
    updatedAt: z.string(),
    queues: z.array(
      z.object({
        bracketId: z.string(),
        bracketType: z.string(),
        divisionId: z.string(),
        divisionName: z.string(),
        queuePaused: z.boolean(),
        queue: z.array(matchSummarySchema),
      }),
    ),
    globalQueue: z.array(
      matchSummarySchema.extend({
        divisionName: z.string(),
        bracketType: z.string(),
        queuePaused: z.boolean(),
      }),
    ),
  })
  .nullable();

const tournamentSummarySchema = z.object({
  slug: z.string(),
  tournamentId: z.string(),
  name: z.string(),
  location: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  totalDivisions: z.number().int().nonnegative(),
  totalBrackets: z.number().int().nonnegative(),
  totalCourts: z.number().int().nonnegative(),
  activeCourts: z.number().int().nonnegative(),
  activeMatches: z.number().int().nonnegative(),
  queuedMatches: z.number().int().nonnegative(),
  divisions: z.array(divisionOverviewSchema),
  courts: z.array(courtSchema),
  queue: queueSnapshotSchema,
});

const divisionListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.string(),
  ageGroup: z.string(),
  format: z.string(),
  bracketCount: z.number().int().nonnegative(),
  teamCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const divisionsListSchema = z.object({
  divisions: z.array(divisionListItemSchema),
});

const divisionBracketSchema = z.object({
  id: z.string(),
  type: z.string(),
  locked: z.boolean(),
  matchCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const divisionTeamSchema = z.object({
  registrationId: z.string(),
  teamId: z.string(),
  teamName: z.string().nullable(),
  entryCode: z.string(),
  seedNote: z.string().nullable(),
});

const divisionDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.string(),
  ageGroup: z.string(),
  format: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  bracketCount: z.number().int().nonnegative(),
  teamCount: z.number().int().nonnegative(),
  brackets: z.array(divisionBracketSchema),
  teams: z.array(divisionTeamSchema),
});

const registrationPlayerSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string().nullable(),
  gender: z.string().nullable(),
});

const registrationDetailSchema = z.object({
  id: z.string(),
  entryCode: z.string(),
  seedNote: z.string().nullable(),
  teamId: z.string(),
  teamName: z.string().nullable(),
  players: z.array(registrationPlayerSchema),
});

const registrationUpdateSchema = z.object({
  id: z.string(),
  entryCode: z.string(),
  seedNote: z.string().nullable(),
  teamId: z.string(),
  teamName: z.string().nullable(),
});

const tournamentImportSummarySchema = z.object({
  divisionsCreated: z.number().int().nonnegative(),
  playersCreated: z.number().int().nonnegative(),
  teamsCreated: z.number().int().nonnegative(),
  registrationsCreated: z.number().int().nonnegative(),
  entryCodes: z.array(
    z.object({
      divisionId: z.string(),
      entryCode: z.string(),
    }),
  ),
});

export type TournamentSummary = z.infer<typeof tournamentSummarySchema>;
export type TournamentListItem = z.infer<typeof tournamentListItemSchema>;
export type TournamentDetail = z.infer<typeof tournamentDetailSchema>;
export type DivisionListItem = z.infer<typeof divisionListItemSchema>;
export type DivisionDetail = z.infer<typeof divisionDetailSchema>;
export type RegistrationDetail = z.infer<typeof registrationDetailSchema>;

export function listTournaments(token?: string) {
  return apiClient
    .get<unknown>(`${baseUrl}/tournaments`, token)
    .then((payload) => tournamentsListSchema.parse(payload));
}

export interface CreateTournamentPayload {
  name: string;
  slug: string;
  location?: string | null;
  plannedCourtCount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}

export type UpdateTournamentPayload = Partial<Omit<CreateTournamentPayload, 'slug'>> & {
  slug?: string;
};

export function createTournament(payload: CreateTournamentPayload, token?: string) {
  return apiClient
    .post<unknown>(`${baseUrl}/tournaments`, payload, token)
    .then((response) => tournamentDetailSchema.parse(response));
}

export function updateTournament(slug: string, payload: UpdateTournamentPayload, token?: string) {
  return apiClient
    .patch<unknown>(`${baseUrl}/tournaments/${slug}`, payload, token)
    .then((response) => tournamentDetailSchema.parse(response));
}

export function deleteTournament(slug: string, token?: string) {
  return apiClient.delete<void>(`${baseUrl}/tournaments/${slug}`, token);
}

export function exportTournamentCsv(slug: string, token?: string) {
  return apiClient.get<string>(`${baseUrl}/tournaments/${slug}/export`, token);
}

export type TournamentImportSummary = z.infer<typeof tournamentImportSummarySchema>;

export function importTournamentCsv(slug: string, csv: string, token?: string) {
  return apiClient
    .post<unknown>(`${baseUrl}/tournaments/${slug}/import`, { csv }, token)
    .then((payload) => tournamentImportSummarySchema.parse(payload));
}

export function getTournamentSummary(slug: string, token?: string) {
  return apiClient
    .get<unknown>(`${baseUrl}/tournaments/${slug}/summary`, token)
    .then((payload) => tournamentSummarySchema.parse(payload));
}

export function listDivisions(slug: string, token?: string) {
  return apiClient
    .get<unknown>(`${baseUrl}/tournaments/${slug}/divisions`, token)
    .then((payload) => divisionsListSchema.parse(payload));
}

export interface CreateDivisionPayload {
  name: string;
  level: string;
  ageGroup: string;
  format: string;
}

export type UpdateDivisionPayload = Partial<CreateDivisionPayload>;

export function createDivision(slug: string, payload: CreateDivisionPayload, token?: string) {
  return apiClient
    .post<unknown>(`${baseUrl}/tournaments/${slug}/divisions`, payload, token)
    .then((response) => divisionListItemSchema.parse(response));
}

export function updateDivision(slug: string, divisionId: string, payload: UpdateDivisionPayload, token?: string) {
  return apiClient
    .patch<unknown>(`${baseUrl}/tournaments/${slug}/divisions/${divisionId}`, payload, token)
    .then((response) => divisionListItemSchema.parse(response));
}

export function deleteDivision(slug: string, divisionId: string, token?: string) {
  return apiClient.delete<void>(`${baseUrl}/tournaments/${slug}/divisions/${divisionId}`, token);
}

export function getDivisionDetail(slug: string, divisionId: string, token?: string) {
  return apiClient
    .get<unknown>(`${baseUrl}/tournaments/${slug}/divisions/${divisionId}`, token)
    .then((payload) => divisionDetailSchema.parse(payload));
}

export interface RegistrationPayload {
  teamId?: string;
  team?: {
    name: string;
    players?: Array<{
      id?: string;
      firstName?: string;
      lastName?: string;
      gender?: string | null;
      dateOfBirth?: string | null;
    }>;
  };
  players?: Array<{
    id?: string;
    firstName?: string;
    lastName?: string;
    gender?: string | null;
    dateOfBirth?: string | null;
  }>;
  seedNote?: string | null;
}

export function createRegistration(slug: string, divisionId: string, payload: RegistrationPayload, token?: string) {
  return apiClient
    .post<unknown>(`${baseUrl}/tournaments/${slug}/divisions/${divisionId}/registrations`, payload, token)
    .then((response) => registrationDetailSchema.parse(response));
}

export function updateRegistration(
  slug: string,
  divisionId: string,
  registrationId: string,
  payload: { seedNote: string | null },
  token?: string,
) {
  return apiClient
    .patch<unknown>(
      `${baseUrl}/tournaments/${slug}/divisions/${divisionId}/registrations/${registrationId}`,
      payload,
      token,
    )
    .then((response) => registrationUpdateSchema.parse(response));
}

export function deleteRegistration(
  slug: string,
  divisionId: string,
  registrationId: string,
  removeTeam = false,
  token?: string,
) {
  const query = removeTeam ? '?removeTeam=true' : '';
  return apiClient.delete<void>(
    `${baseUrl}/tournaments/${slug}/divisions/${divisionId}/registrations/${registrationId}${query}`,
    token,
  );
}
