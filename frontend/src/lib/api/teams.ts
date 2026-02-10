import { z } from 'zod';
import { apiClient } from './client';

const baseUrl = '/api/v1';

const teamPlayerSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string().nullable(),
  gender: z.string().nullable(),
});

const teamRegistrationSchema = z.object({
  id: z.string(),
  divisionId: z.string(),
  divisionName: z.string().nullable(),
  tournamentSlug: z.string().nullable(),
  entryCode: z.string(),
  seedNote: z.string().nullable(),
});

const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  players: z.array(teamPlayerSchema),
  registrations: z.array(teamRegistrationSchema),
});

const teamsListSchema = z.object({
  teams: z.array(teamSchema),
});

export type Team = z.infer<typeof teamSchema>;

export interface TeamPlayerInput {
  id?: string;
  firstName?: string;
  lastName?: string;
  gender?: string | null;
  dateOfBirth?: string | null;
}

export interface CreateTeamPayload {
  name: string;
  players?: TeamPlayerInput[];
}

export type UpdateTeamPayload = Partial<CreateTeamPayload>;

export interface ListTeamParams {
  search?: string;
  tournamentSlug?: string;
  divisionId?: string;
}

export function listTeams(params: ListTeamParams = {}, token?: string) {
  const query = new URLSearchParams();

  if (params.search) {
    query.set('search', params.search);
  }

  if (params.tournamentSlug) {
    query.set('tournamentSlug', params.tournamentSlug);
  }

  if (params.divisionId) {
    query.set('divisionId', params.divisionId);
  }

  const target = query.toString() ? `${baseUrl}/teams?${query.toString()}` : `${baseUrl}/teams`;

  return apiClient
    .get<unknown>(target, token)
    .then((payload) => teamsListSchema.parse(payload));
}

export function createTeam(payload: CreateTeamPayload, token?: string) {
  return apiClient
    .post<unknown>(`${baseUrl}/teams`, payload, token)
    .then((response) => teamSchema.parse(response));
}

export function updateTeam(teamId: string, payload: UpdateTeamPayload, token?: string) {
  return apiClient
    .patch<unknown>(`${baseUrl}/teams/${teamId}`, payload, token)
    .then((response) => teamSchema.parse(response));
}

export function deleteTeam(teamId: string, token?: string) {
  return apiClient.delete<void>(`${baseUrl}/teams/${teamId}`, token);
}
