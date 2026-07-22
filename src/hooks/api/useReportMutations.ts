import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveReport, type SaveReportPayload } from '../../api/saveReport';
import {
  saveStoreCheck,
  type StoreCheckPayload,
} from '../../api/saveStoreCheck';
import { queryKeys } from '../../api/queryKeys';

export function useSaveDisplayReportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveReportPayload) => saveReport(payload, 'display'),
    onSuccess: async result => {
      if (!result.success) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.photoReports });
    },
  });
}

export function useSaveBonusReportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveReportPayload) => saveReport(payload, 'bonus'),
    onSuccess: async result => {
      if (!result.success) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.photoReports });
    },
  });
}

export function useSaveStoreCheckMutation() {
  return useMutation({
    mutationFn: (payload: StoreCheckPayload) => saveStoreCheck(payload),
  });
}
