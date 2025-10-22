import { useQuery } from '@tanstack/react-query';
import { getMatchDetail, MatchDetail } from '../api/matches';
import { useAuth } from '../auth/AuthContext';

const matchKeys = {
  detail: (slug: string, matchId: string) => ['matchDetail', slug, matchId] as const,
};

export function useMatchDetail(slug: string, matchId: string, token?: string) {
  const { token: authToken } = useAuth();
  const resolvedToken = token ?? authToken ?? undefined;

  return useQuery<MatchDetail>({
    queryKey: matchKeys.detail(slug, matchId),
    queryFn: () => getMatchDetail(slug, matchId, resolvedToken),
    enabled: Boolean(resolvedToken && slug && matchId),
  });
}

export { matchKeys };
