import { useQuery } from '@tanstack/react-query';
import { getPublicStandings, PublicTournamentStandings } from '../api/public';

const publicKeys = {
  standings: (slug: string) => ['publicStandings', slug] as const,
};

export function usePublicStandings(slug: string, options?: { refetchInterval?: number }) {
  return useQuery<PublicTournamentStandings>({
    queryKey: publicKeys.standings(slug),
    queryFn: () => getPublicStandings(slug),
    enabled: Boolean(slug),
    staleTime: 30_000,
    refetchInterval: options?.refetchInterval,
  });
}

export { publicKeys };
