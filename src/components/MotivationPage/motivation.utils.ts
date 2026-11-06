import { MOTIVATION_DIRECTIONS as directions } from '../../types/motivation';
import type { MotivationFilters, MotivationRecord, MotivationState } from '../../types/motivation';
export const newId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv' }).format(new Date());
export const formatNumber = (value: number) => new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1 }).format(value);
export const formatDate = (value: string) => value ? new Date(value + 'T12:00:00Z').toLocaleDateString('uk-UA', { timeZone: 'UTC' }) : '—';
export function shiftMonths(value: string, months: number) {
  const date = new Date(value + 'T12:00:00Z');
  const day = date.getUTCDate(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last)); return date.toISOString().slice(0, 10);
}
export function shiftDays(value: string, days: number) { const date = new Date(value + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
export function periods(filters: MotivationFilters) {
  const start = shiftMonths(shiftDays(filters.end, 1), -filters.months);
  return { start, end: filters.end, previousStart: shiftMonths(start, -filters.months), previousEnd: shiftDays(start, -1) };
}
export function selectRows(data: MotivationState, filters: MotivationFilters, previous = false) {
  const range = periods(filters);
  return data.records.filter(r => r.date >= (previous ? range.previousStart : range.start) && r.date <= (previous ? range.previousEnd : range.end) && (filters.agent === '' || filters.agent === r.agent) && (filters.route === '' || filters.route === r.route));
}
export function meanPerformance(rows: MotivationRecord[]) {
  const valid = rows.filter(r => r.status === 'підтверджено' && r.actual !== null && r.target !== null && r.target > 0);
  return valid.length ? valid.reduce((sum, r) => sum + Math.min(100, r.actual! / r.target! * 100), 0) / valid.length : null;
}
export function debtStatus(record: MotivationRecord, buffer: number, asOf: string) {
  if (!record.invoiceDate || record.balance === '') return { label: 'Недостатньо даних про борг', critical: false, due: '', criticalDate: '' };
  const due = shiftDays(record.invoiceDate, record.term), criticalDate = shiftDays(due, buffer);
  const critical = record.balance > 0 && asOf > criticalDate;
  return { label: record.balance <= 0 ? 'Борг відсутній' : critical ? 'Критична прострочка' : asOf > due ? 'У межах буфера' : 'Строк не минув', critical, due, criticalDate };
}
export function blankRecord(): MotivationRecord { return { id: newId(), agent: '1', route: '', date: today(), direction: 'АКБ', actual: null, target: null, status: 'не перевірено', evidence: '', owner: '', recheck: '', issue: '', note: '', invoiceDate: '', term: 14, balance: '' }; }
export function nextSteps(rows: MotivationRecord[], data: MotivationState, end: string) {
  const pending = rows.filter(r => r.status === 'не перевірено').length;
  const problems = rows.filter(r => r.status === 'проблема' || r.issue || r.direction === 'Дебіторка' && debtStatus(r, data.buffer, end).critical).length;
  return [pending ? `Перевірити ${pending} непідтверджених записів і додати джерела.` : 'Зібрати підтверджені результати наступного періоду.', problems ? `Опрацювати ${problems} проблемних записів: призначити відповідальних і строки.` : 'Перевірити повноту результатів усіх 10 агентів.', 'Зіставити повторні перевірки та погодити тестові цілі перед розрахунком бонусів.'];
}
export function buildReport(data: MotivationState, filters: MotivationFilters) {
  const rows = selectRows(data, filters), previous = selectRows(data, filters, true), range = periods(filters);
  const agent = (id: string) => data.agents.find(a => a.id === id)?.name || id;
  const problems = rows.filter(r => r.status === 'проблема' || r.issue || r.direction === 'Дебіторка' && debtStatus(r, data.buffer, filters.end).critical);
  return `ЛАСКА · ТЕСТ СИСТЕМИ МОТИВАЦІЇ\n${formatDate(range.start)} — ${formatDate(range.end)}\nАгент: ${filters.agent ? agent(filters.agent) : 'усі'}; маршрут: ${filters.route || 'усі'}\n\nЗаписів: ${rows.length}; підтверджено: ${rows.filter(r => r.status === 'підтверджено').length}; не перевірено: ${rows.filter(r => r.status === 'не перевірено').length}.\n${directions.map(d => { const rs = rows.filter(r => r.direction === d), value = meanPerformance(rs), prev = meanPerformance(previous.filter(r => r.direction === d)); return `${d}: ${value === null ? 'немає підтверджених даних' : formatNumber(value) + '% середнього виконання'}; попередній період: ${prev === null ? 'немає підтверджених даних' : formatNumber(prev) + '%'}.`; }).join('\n')}\n\nНевирішені питання:\n${problems.map(r => `${agent(r.agent)} / ${r.route}: ${r.issue || (r.direction === 'Дебіторка' ? debtStatus(r, data.buffer, filters.end).label : 'Потребує перевірки')}. Відповідальний: ${r.owner || 'не призначено'}; повторна перевірка: ${formatDate(r.recheck)}; статус: ${r.status}.`).join('\n') || 'Зареєстрованих питань немає. Це не підтверджує відсутність проблем.'}\n\nТри наступні кроки:\n${nextSteps(rows, data, filters.end).map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nБез штрафів. Непідтверджені дані не беруть участі в показниках. Середнє розраховано за відсотками виконання записів, максимум 100%. Це тестовий звіт, а не відомість виплат.`;
}
export function downloadFile(name: string, text: string, type = 'application/json') { const url = URL.createObjectURL(new Blob([text], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
