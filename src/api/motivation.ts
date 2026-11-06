import { apiGet, apiPostJson, getActiveTenant } from './client';
import type { MotivationHistory, MotivationResponse, MotivationState } from '../types/motivation';
function requireLaska() { if (getActiveTenant() !== 'laska') throw new Error('Оберіть компанію Ласка'); }
export function fetchMotivation(signal?: AbortSignal) {
  requireLaska();
  return apiGet<MotivationResponse>('/api/motivation/state', { authenticated: true, signal });
}
export function saveMotivation(data: MotivationState, revision: number, action: string) {
  requireLaska();
  return apiPostJson<{ revision: number; history: MotivationHistory }, { data: MotivationState; revision: number; action: string }>('/api/motivation/state', { data, revision, action }, { authenticated: true, tenant: 'laska' });
}
export function fetchMotivationHistory(before?: number) {
  requireLaska();
  return apiGet<MotivationHistory[]>('/api/motivation/history', { authenticated: true, query: { before } });
}
export function fetchMotivationSnapshot(id: string) {
  requireLaska();
  return apiGet<MotivationHistory & { data: MotivationState }>('/api/motivation/history/' + encodeURIComponent(id), { authenticated: true });
}
