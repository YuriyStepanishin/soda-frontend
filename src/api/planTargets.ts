import type { PlanColumn } from '../components/ImplementationPage/planColumnsStorage';

export async function fetchPlanColumns(): Promise<PlanColumn[]> {
  throw new Error('Plan targets API не реалізовано на новому бекенді.');
}

export async function savePlanColumnsToSheet(
  columns: PlanColumn[]
): Promise<void> {
  void columns;
  throw new Error(
    'Збереження plan targets поки не реалізовано на новому бекенді.'
  );
}
