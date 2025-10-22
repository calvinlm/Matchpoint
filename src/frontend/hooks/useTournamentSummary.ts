'use client';

import { useQuery } from '@tanstack/react-query';
import { getTournamentSummary, TournamentSummary } from '../api/tournaments';
import { useAuth } from '../auth/AuthContext';

export function useTournamentSummary(slug: string, token?: string) {
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;

  return useQuery<TournamentSummary>({
    queryKey: ['tournamentSummary', slug],
    queryFn: () => getTournamentSummary(slug, resolvedToken),
    enabled: Boolean(slug && resolvedToken),
    refetchInterval: 60_000,
  });
}

export type { TournamentSummary };
