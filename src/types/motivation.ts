export const MOTIVATION_DIRECTIONS = ['АКБ', 'Асортимент', 'Мерчандайзинг', 'Дебіторка'] as const;
export const MOTIVATION_STATUSES = ['підтверджено', 'проблема', 'не перевірено'] as const;
export type MotivationDirection = typeof MOTIVATION_DIRECTIONS[number];
export type MotivationStatus = typeof MOTIVATION_STATUSES[number];
export interface MotivationAgent { id: string; name: string }
export interface MotivationRecord {
  id: string; agent: string; route: string; date: string; direction: MotivationDirection;
  actual: number | null; target: number | null; status: MotivationStatus;
  evidence: string; owner: string; recheck: string; issue: string; note: string;
  invoiceDate: string; term: number; balance: number | '';
}
export interface MotivationState { agents: MotivationAgent[]; records: MotivationRecord[]; budget: number; buffer: number }
export interface MotivationHistory { id: string; revision: number; at: string; actor: string; action: string }
export interface MotivationResponse { data: MotivationState; revision: number }
export interface MotivationFilters { months: number; end: string; agent: string; route: string }
