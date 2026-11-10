import { apiGet, apiPostJson, getActiveTenant } from './client';
export type DebtStatus = 'current' | 'overdue' | 'penalty' | 'prepayment';
export type Receivable = { id: number; route: string; store: string; agent: string | null; department: string | null;
  date: string; number: string; type: string; days: number; amount: number | null; balance: number; network: boolean; status: DebtStatus };
export type ReceivablesResponse = {
  metadata: { file_name: string; modified_time: string; report_date: string; imported_at: string; row_count?: number; unmatched_routes?: number; control_difference?: number | null } | null;
  options: { agent: string | null; route: string }[];
  totals: { balance: number; debt: number; prepayment: number; overdue: number; penalty: number; penaltyAmount: number; stores: number };
  rows: Receivable[]; pagination: { page: number; limit: number; total: number; pages: number };
};
export type DebtFilters = { agent: string; route: string; search: string; status: string; page: number };
function requireLaska() { if (getActiveTenant() !== 'laska') throw new Error('Оберіть компанію Ласка'); }
export function fetchReceivables(query: DebtFilters, signal?: AbortSignal) {
  requireLaska();
  return apiGet<ReceivablesResponse>('/api/laska/receivables', { query, authenticated: true, signal });
}
export function importReceivables() {
  requireLaska();
  return apiPostJson<{ found: number; processed: number; inserted?: number; skippedOlder?: boolean; cleanupErrors?: {message: string}[] }, Record<string, never>>(
    '/api/laska/receivables/import', {}, { authenticated: true, tenant: 'laska' });
}
