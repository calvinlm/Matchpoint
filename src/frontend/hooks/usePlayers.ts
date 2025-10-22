import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listPlayers, createPlayer, updatePlayer, deletePlayer, type CreatePlayerPayload, type UpdatePlayerPayload } from '@/frontend/api/players';
import { useAuth } from '../auth/AuthContext';

const playerKeys = {
  list: (search: string) => ['players', search] as const,
  all: ['players'] as const,
};

export function usePlayers(search = '') {
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useQuery({
    queryKey: playerKeys.list(search),
    queryFn: () => listPlayers({ search }, resolvedToken),
    enabled: Boolean(resolvedToken),
  });
}

export function useCreatePlayer() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useMutation({
    mutationFn: (payload: CreatePlayerPayload) => createPlayer(payload, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playerKeys.all, exact: false });
    },
  });
}

export function useUpdatePlayer(playerId: string) {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useMutation({
    mutationFn: (payload: UpdatePlayerPayload) => updatePlayer(playerId, payload, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playerKeys.all, exact: false });
    },
  });
}

export function useDeletePlayer() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  return useMutation({
    mutationFn: (playerId: string) => deletePlayer(playerId, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playerKeys.all, exact: false });
    },
  });
}

export { playerKeys };
