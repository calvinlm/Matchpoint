import { useQuery } from '@tanstack/react-query';
import { getPublicBrackets, PublicTournamentBrackets } from '../api/public';

const publicBracketKeys = {
  list: (slug: string) => ['publicBrackets', slug] as const,
};

export function usePublicBrackets(slug: string, options?: { refetchInterval?: number }) {
  return useQuery<PublicTournamentBrackets>({
    queryKey: publicBracketKeys.list(slug),
    queryFn: () => getPublicBrackets(slug),
    enabled: Boolean(slug),
    staleTime: 30_000,
    refetchInterval: options?.refetchInterval,
  });
}

export { publicBracketKeys };
