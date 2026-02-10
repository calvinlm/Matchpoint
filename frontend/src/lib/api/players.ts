import { z } from 'zod';
import { apiClient } from './client';

const baseUrl = '/api/v1';

const playerTeamSchema = z.object({
  teamId: z.string(),
  teamName: z.string().nullable(),
});

const playerSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  gender: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  teams: z.array(playerTeamSchema),
});

const playersListSchema = z.object({
  players: z.array(playerSchema),
});

export type Player = z.infer<typeof playerSchema>;

export interface CreatePlayerPayload {
  firstName: string;
  lastName: string;
  gender?: string | null;
  dateOfBirth?: string | null;
}

export type UpdatePlayerPayload = Partial<CreatePlayerPayload>;

export function listPlayers(params: { search?: string; limit?: number } = {}, token?: string) {
  const query = new URLSearchParams();
  if (params.search) {
    query.set('search', params.search);
  }
  if (params.limit) {
    query.set('limit', String(params.limit));
  }

  const target = query.toString() ? `${baseUrl}/players?${query.toString()}` : `${baseUrl}/players`;

  return apiClient
    .get<unknown>(target, token)
    .then((payload) => playersListSchema.parse(payload));
}

export function createPlayer(payload: CreatePlayerPayload, token?: string) {
  return apiClient
    .post<unknown>(`${baseUrl}/players`, payload, token)
    .then((response) => playerSchema.parse(response));
}

export function updatePlayer(playerId: string, payload: UpdatePlayerPayload, token?: string) {
  return apiClient
    .patch<unknown>(`${baseUrl}/players/${playerId}`, payload, token)
    .then((response) => playerSchema.parse(response));
}

export function deletePlayer(playerId: string, token?: string) {
  return apiClient.delete<void>(`${baseUrl}/players/${playerId}`, token);
}
