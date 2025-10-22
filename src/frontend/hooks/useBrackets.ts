import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listBrackets,
  createBracket,
  updateBracket,
  applySeeding,
  listDivisionTeams,
  Bracket,
  CreateBracketPayload,
  UpdateBracketPayload,
  ApplySeedingPayload,
  MatchConflict,
  BracketSchedule,
  MatchSummary,
  TeamWithSeed,
  getBracketSchedule,
  updateMatchAssignment,
  UpdateMatchAssignmentPayload,
  rescheduleMatches,
  retireMatches,
  swapMatches,
  setQueuePause,
  reorderQueue,
  getTournamentQueue,
  BulkReschedulePayload,
  RetireMatchesPayload,
  SwapMatchesPayload,
  ReorderQueuePayload,
  TournamentQueue,
  BracketQueue,
  submitMatchScore,
  SubmitMatchScorePayload,
  getBracketStandings,
  BracketStandings,
  BracketStandingRow,
  deleteBracket,
} from '../api/brackets';
import { useAuth } from '../auth/AuthContext';

export const bracketKeys = {
  list: (slug: string) => ['brackets', slug] as const,
  divisionTeams: (slug: string, divisionId: string, bracketId?: string) =>
    ['divisionTeams', slug, divisionId, bracketId ?? 'unassigned'] as const,
  schedule: (slug: string, bracketId: string) => ['bracketSchedule', slug, bracketId] as const,
  tournamentQueue: (slug: string) => ['tournamentQueue', slug] as const,
  standings: (slug: string, bracketId: string) => ['bracketStandings', slug, bracketId] as const,
};

export function useBrackets(slug: string, token?: string) {
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;
  return useQuery({
    queryKey: bracketKeys.list(slug),
    queryFn: () => listBrackets(slug, resolvedToken),
    enabled: Boolean(resolvedToken),
  });
}

export function useCreateBracket(slug: string, divisionId: string, token?: string) {
  const queryClient = useQueryClient();
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;

  return useMutation({
    mutationFn: (payload: CreateBracketPayload) => createBracket(slug, divisionId, payload, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bracketKeys.list(slug) });
    },
  });
}

export function useUpdateBracket(slug: string, token?: string) {
  const queryClient = useQueryClient();
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;

  return useMutation({
    mutationFn: (input: { bracketId: string; payload: UpdateBracketPayload }) =>
      updateBracket(slug, input.bracketId, input.payload, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bracketKeys.list(slug) });
    },
  });
}

export function useDeleteBracket(slug: string, token?: string) {
  const queryClient = useQueryClient();
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;

  return useMutation({
    mutationFn: (bracketId: string) => deleteBracket(slug, bracketId, resolvedToken),
    onSuccess: (_data, bracketId) => {
      queryClient.invalidateQueries({ queryKey: bracketKeys.list(slug) });
      queryClient.invalidateQueries({ queryKey: bracketKeys.schedule(slug, bracketId) });
      queryClient.invalidateQueries({ queryKey: bracketKeys.tournamentQueue(slug) });
      queryClient.invalidateQueries({ queryKey: bracketKeys.standings(slug, bracketId) });
      queryClient.invalidateQueries({ queryKey: ['tournamentSummary', slug] });
    },
  });
}

export function useApplySeeding(slug: string, bracketId: string, divisionId: string, token?: string) {
  const queryClient = useQueryClient();
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;

  return useMutation({
    mutationFn: (payload: ApplySeedingPayload) => applySeeding(slug, bracketId, payload, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bracketKeys.list(slug) });
      queryClient.invalidateQueries({
        queryKey: bracketKeys.divisionTeams(slug, divisionId, bracketId),
      });
    },
  });
}

export function useDivisionTeams(slug: string, divisionId: string, bracketId?: string, token?: string) {
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;
  return useQuery({
    queryKey: bracketKeys.divisionTeams(slug, divisionId, bracketId),
    queryFn: () => listDivisionTeams(slug, divisionId, bracketId, resolvedToken),
    enabled: Boolean(resolvedToken),
  });
}

export function useBracketSchedule(slug: string, bracketId: string, token?: string) {
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;
  return useQuery({
    queryKey: bracketKeys.schedule(slug, bracketId),
    queryFn: () => getBracketSchedule(slug, bracketId, resolvedToken),
    refetchInterval: 30_000,
    enabled: Boolean(resolvedToken),
  });
}

export function useAssignMatch(slug: string, bracketId: string, token?: string) {
  const queryClient = useQueryClient();
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;

  return useMutation({
    mutationFn: (input: { matchId: string; payload: UpdateMatchAssignmentPayload }) =>
      updateMatchAssignment(slug, bracketId, input.matchId, input.payload, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bracketKeys.schedule(slug, bracketId) });
    },
  });
}

export function useRescheduleMatches(slug: string, bracketId: string, token?: string) {
  const queryClient = useQueryClient();
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;

  return useMutation({
    mutationFn: (payload: BulkReschedulePayload) => rescheduleMatches(slug, bracketId, payload, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bracketKeys.schedule(slug, bracketId) });
    },
  });
}

export function useRetireMatches(slug: string, bracketId: string, token?: string) {
  const queryClient = useQueryClient();
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;

  return useMutation({
    mutationFn: (payload: RetireMatchesPayload) => retireMatches(slug, bracketId, payload, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bracketKeys.schedule(slug, bracketId) });
    },
  });
}

export function useSwapMatches(slug: string, bracketId: string, token?: string) {
  const queryClient = useQueryClient();
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;

  return useMutation({
    mutationFn: (payload: SwapMatchesPayload) => swapMatches(slug, bracketId, payload, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bracketKeys.schedule(slug, bracketId) });
    },
  });
}

export function useQueuePause(slug: string, bracketId: string, token?: string) {
  const queryClient = useQueryClient();
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;

  return useMutation({
    mutationFn: (paused: boolean) => setQueuePause(slug, bracketId, paused, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bracketKeys.schedule(slug, bracketId) });
    },
  });
}

export function useReorderQueue(slug: string, bracketId: string, token?: string) {
  const queryClient = useQueryClient();
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;

  return useMutation({
    mutationFn: (payload: ReorderQueuePayload) => reorderQueue(slug, bracketId, payload, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bracketKeys.schedule(slug, bracketId) });
    },
  });
}

export function useTournamentQueue(slug: string, token?: string) {
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;
  return useQuery({
    queryKey: bracketKeys.tournamentQueue(slug),
    queryFn: () => getTournamentQueue(slug, resolvedToken),
    refetchInterval: 30_000,
    enabled: Boolean(resolvedToken),
  });
}

export function useBracketStandings(slug: string, bracketId: string, token?: string) {
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;

  return useQuery({
    queryKey: bracketKeys.standings(slug, bracketId),
    queryFn: () => getBracketStandings(slug, bracketId, resolvedToken),
    enabled: Boolean(resolvedToken),
  });
}

export function useSubmitMatchScore(slug: string, bracketId: string, token?: string) {
  const queryClient = useQueryClient();
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;

  return useMutation({
    mutationFn: (input: { matchId: string; payload: SubmitMatchScorePayload }) =>
      submitMatchScore(slug, bracketId, input.matchId, input.payload, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bracketKeys.schedule(slug, bracketId) });
      queryClient.invalidateQueries({ queryKey: bracketKeys.list(slug) });
      queryClient.invalidateQueries({ queryKey: bracketKeys.tournamentQueue(slug) });
      queryClient.invalidateQueries({ queryKey: bracketKeys.standings(slug, bracketId) });
    },
  });
}

export type { Bracket, TeamWithSeed, CreateBracketPayload, UpdateBracketPayload, ApplySeedingPayload };
export type {
  BracketSchedule,
  MatchSummary,
  MatchConflict,
  UpdateMatchAssignmentPayload,
  BulkReschedulePayload,
  RetireMatchesPayload,
  SwapMatchesPayload,
  ReorderQueuePayload,
  TournamentQueue,
  BracketQueue,
  BracketStandings,
  BracketStandingRow,
  SubmitMatchScorePayload,
};
