import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listTournaments,
  createTournament,
  updateTournament,
  deleteTournament,
  listDivisions,
  createDivision,
  updateDivision,
  deleteDivision,
  getDivisionDetail,
  createRegistration,
  updateRegistration,
  deleteRegistration,
  type CreateTournamentPayload,
  type UpdateTournamentPayload,
  type CreateDivisionPayload,
  type UpdateDivisionPayload,
  type RegistrationPayload,
  type TournamentListItem,
  type DivisionListItem,
  type DivisionDetail,
} from '@/frontend/api/tournaments';
import { bracketKeys } from './useBrackets';
import { teamKeys } from './useTeams';
import { useAuth } from '../auth/AuthContext';

const tournamentAdminKeys = {
  list: ['tournaments'] as const,
  divisions: (slug: string) => ['tournaments', slug, 'divisions'] as const,
  divisionDetail: (slug: string, divisionId: string) => ['tournaments', slug, 'divisions', divisionId] as const,
};

export function useTournamentList() {
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useQuery<{ tournaments: TournamentListItem[] }>({
    queryKey: tournamentAdminKeys.list,
    queryFn: () => listTournaments(resolvedToken),
    enabled: Boolean(resolvedToken),
  });
}

export function useCreateTournament() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useMutation({
    mutationFn: (payload: CreateTournamentPayload) => createTournament(payload, resolvedToken),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tournamentAdminKeys.list });
      queryClient.invalidateQueries({ queryKey: ['tournamentSummary', data.slug] });
    },
  });
}

export function useUpdateTournament(currentSlug: string) {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useMutation({
    mutationFn: (payload: UpdateTournamentPayload) => updateTournament(currentSlug, payload, resolvedToken),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tournamentAdminKeys.list });
      queryClient.invalidateQueries({ queryKey: ['tournamentSummary', currentSlug] });
      if (data.slug !== currentSlug) {
        queryClient.invalidateQueries({ queryKey: ['tournamentSummary', data.slug] });
      }
    },
  });
}

export function useDeleteTournament() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useMutation({
    mutationFn: (slug: string) => deleteTournament(slug, resolvedToken),
    onSuccess: (_data, slug) => {
      queryClient.invalidateQueries({ queryKey: tournamentAdminKeys.list });
      queryClient.invalidateQueries({ queryKey: ['tournamentSummary', slug] });
    },
  });
}

export function useTournamentDivisions(slug: string) {
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useQuery<{ divisions: DivisionListItem[] }>({
    queryKey: tournamentAdminKeys.divisions(slug),
    queryFn: () => listDivisions(slug, resolvedToken),
    enabled: Boolean(slug && resolvedToken),
  });
}

export function useCreateDivision(slug: string) {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useMutation({
    mutationFn: (payload: CreateDivisionPayload) => createDivision(slug, payload, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tournamentAdminKeys.divisions(slug) });
      queryClient.invalidateQueries({ queryKey: ['tournamentSummary', slug] });
    },
  });
}

export function useUpdateDivision(slug: string, divisionId: string) {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useMutation({
    mutationFn: (payload: UpdateDivisionPayload) => updateDivision(slug, divisionId, payload, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tournamentAdminKeys.divisions(slug) });
      queryClient.invalidateQueries({ queryKey: tournamentAdminKeys.divisionDetail(slug, divisionId) });
      queryClient.invalidateQueries({ queryKey: ['tournamentSummary', slug] });
    },
  });
}

export function useDeleteDivision(slug: string) {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useMutation({
    mutationFn: (divisionId: string) => deleteDivision(slug, divisionId, resolvedToken),
    onSuccess: (_data, divisionId) => {
      queryClient.invalidateQueries({ queryKey: tournamentAdminKeys.divisions(slug) });
      queryClient.invalidateQueries({ queryKey: tournamentAdminKeys.divisionDetail(slug, divisionId) });
      queryClient.invalidateQueries({ queryKey: ['tournamentSummary', slug] });
      queryClient.invalidateQueries({ queryKey: ['brackets', slug] });
    },
  });
}

export function useDivisionDetail(slug: string, divisionId: string) {
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useQuery<DivisionDetail>({
    queryKey: tournamentAdminKeys.divisionDetail(slug, divisionId),
    queryFn: () => getDivisionDetail(slug, divisionId, resolvedToken),
    enabled: Boolean(slug && divisionId && resolvedToken),
  });
}

export function useCreateRegistration(slug: string) {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useMutation({
    mutationFn: (variables: { divisionId: string; payload: RegistrationPayload }) =>
      createRegistration(slug, variables.divisionId, variables.payload, resolvedToken),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tournamentAdminKeys.divisions(slug) });
      queryClient.invalidateQueries({ queryKey: tournamentAdminKeys.divisionDetail(slug, variables.divisionId) });
      queryClient.invalidateQueries({ queryKey: bracketKeys.divisionTeams(slug, variables.divisionId) });
      queryClient.invalidateQueries({ queryKey: bracketKeys.list(slug) });
      queryClient.invalidateQueries({ queryKey: ['tournamentSummary', slug] });
      queryClient.invalidateQueries({ queryKey: teamKeys.all, exact: false });
    },
  });
}

export function useUpdateRegistration(slug: string, divisionId: string, registrationId: string) {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useMutation({
    mutationFn: (payload: { seedNote: string | null }) =>
      updateRegistration(slug, divisionId, registrationId, payload, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tournamentAdminKeys.divisionDetail(slug, divisionId) });
      queryClient.invalidateQueries({ queryKey: bracketKeys.divisionTeams(slug, divisionId) });
    },
  });
}

export function useDeleteRegistration(slug: string) {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useMutation({
    mutationFn: (variables: { divisionId: string; registrationId: string; removeTeam?: boolean }) =>
      deleteRegistration(
        slug,
        variables.divisionId,
        variables.registrationId,
        variables.removeTeam ?? false,
        resolvedToken,
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tournamentAdminKeys.divisions(slug) });
      queryClient.invalidateQueries({ queryKey: tournamentAdminKeys.divisionDetail(slug, variables.divisionId) });
      queryClient.invalidateQueries({ queryKey: bracketKeys.divisionTeams(slug, variables.divisionId) });
      if (variables.removeTeam) {
        queryClient.invalidateQueries({ queryKey: teamKeys.all, exact: false });
      }
    },
  });
}
