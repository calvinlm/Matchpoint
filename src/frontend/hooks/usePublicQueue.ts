import { useQuery } from '@tanstack/react-query';
import { getPublicQueueTable, PublicTournamentQueue } from '../api/public';

const publicQueueKeys = {
  table: (slug: string) => ['publicQueue', slug] as const,
};

export function usePublicQueue(slug: string, options?: { refetchInterval?: number }) {
  return useQuery<PublicTournamentQueue>({
    queryKey: publicQueueKeys.table(slug),
    queryFn: () => getPublicQueueTable(slug),
    enabled: Boolean(slug),
    staleTime: 15_000,
    refetchInterval: options?.refetchInterval,
  });
}

export { publicQueueKeys };
