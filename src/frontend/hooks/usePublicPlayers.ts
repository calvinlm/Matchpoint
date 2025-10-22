import { useQuery } from '@tanstack/react-query';
import { getPublicPlayers, PublicTournamentPlayers } from '../api/public';

const publicPlayerKeys = {
  list: (slug: string) => ['publicPlayers', slug] as const,
};

export function usePublicPlayers(slug: string, options?: { refetchInterval?: number }) {
  return useQuery<PublicTournamentPlayers>({
    queryKey: publicPlayerKeys.list(slug),
    queryFn: () => getPublicPlayers(slug),
    enabled: Boolean(slug),
    staleTime: 30_000,
    refetchInterval: options?.refetchInterval,
  });
}

export { publicPlayerKeys };
