import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMotivation, fetchMotivationHistory, saveMotivation } from '../../api/motivation';
import type { MotivationState, MotivationResponse } from '../../types/motivation';
const stateKey = ['motivation', 'laska', 'state'] as const;
const historyKey = ['motivation', 'laska', 'history'] as const;
export function useMotivation() {
  const client = useQueryClient();
  const state = useQuery({ queryKey: stateKey, queryFn: ({ signal }) => fetchMotivation(signal), retry: false, refetchOnWindowFocus: true, refetchInterval: 15 * 60 * 1000 });
  const history = useQuery({ queryKey: historyKey, queryFn: () => fetchMotivationHistory(), retry: false, refetchOnWindowFocus: true, refetchInterval: 15 * 60 * 1000 });
  const mutation = useMutation({ mutationFn: ({ data, action, revision }: { data: MotivationState; action: string; revision: number }) => saveMotivation(data, revision, action),
    onSuccess: (result, input) => { client.setQueryData<MotivationResponse>(stateKey, { data: input.data, revision: result.revision }); void client.invalidateQueries({ queryKey: historyKey }); },
  });
  return { state, history, mutation };
}
