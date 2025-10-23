import { useMutation, useQueryClient } from '@tanstack/react-query';
import { importTournamentCsv, exportTournamentCsv } from '@/frontend/api/tournaments';
import { useAuth } from '../auth/AuthContext';
import { teamKeys } from './useTeams';
import { playerKeys } from './usePlayers';

export function useTournamentCsv(slug: string) {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const resolvedToken = token ?? undefined;

  const importMutation = useMutation({
    mutationFn: (csv: string) => importTournamentCsv(slug, csv, resolvedToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['tournaments', slug, 'divisions'] });
      queryClient.invalidateQueries({ queryKey: ['tournamentSummary', slug] });
      queryClient.invalidateQueries({ queryKey: ['teams'], exact: false });
      queryClient.invalidateQueries({ queryKey: teamKeys.all, exact: false });
      queryClient.invalidateQueries({ queryKey: ['players'], exact: false });
      queryClient.invalidateQueries({ queryKey: playerKeys.all, exact: false });
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => exportTournamentCsv(slug, resolvedToken),
  });

  return {
    importCsv: importMutation.mutateAsync,
    isImporting: importMutation.isPending,
    exportCsv: exportMutation.mutateAsync,
    isExporting: exportMutation.isPending,
  };
}
