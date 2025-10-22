import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listTeams, createTeam, updateTeam, deleteTeam, type ListTeamParams, type CreateTeamPayload, type UpdateTeamPayload } from '@/frontend/api/teams';
import { useAuth } from '../auth/AuthContext';

const teamKeys = {
  all: ['teams'] as const,
  list: (paramsKey: string) => ['teams', paramsKey] as const,
  tournament: (slug: string) => ['teams', 'tournament', slug] as const,
};

function buildParamsKey(params: ListTeamParams) {
  const parts = [params.search ?? ''];
  parts.push(params.tournamentSlug ?? 'all');
  parts.push(params.divisionId ?? 'all');
  return parts.join(':');
}

export function useTeams(params: ListTeamParams = {}) {
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;
  const key = buildParamsKey(params);

  return useQuery({
    queryKey: teamKeys.list(key),
    queryFn: () => listTeams(params, resolvedToken),
    enabled: Boolean(resolvedToken),
  });
}

export function useTournamentTeams(slug: string) {
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useQuery({
    queryKey: teamKeys.tournament(slug),
    queryFn: () => listTeams({ tournamentSlug: slug }, resolvedToken),
    enabled: Boolean(slug && resolvedToken),
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useMutation({
    mutationFn: (payload: CreateTeamPayload) => createTeam(payload, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
      queryClient.invalidateQueries({ queryKey: ['teams'], exact: false });
    },
  });
}

export function useUpdateTeam(teamId: string) {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useMutation({
    mutationFn: (payload: UpdateTeamPayload) => updateTeam(teamId, payload, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
      queryClient.invalidateQueries({ queryKey: ['teams'], exact: false });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useMutation({
    mutationFn: (teamId: string) => deleteTeam(teamId, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
      queryClient.invalidateQueries({ queryKey: ['teams'], exact: false });
    },
  });
}

export { teamKeys };
