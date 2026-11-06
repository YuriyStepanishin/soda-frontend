import { useEffect, useRef, useState } from 'react';
import { MOTIVATION_DIRECTIONS as directions, MOTIVATION_STATUSES as statuses } from '../../types/motivation';
import type { MotivationState, MotivationRecord, MotivationDirection, MotivationStatus } from '../../types/motivation';
import { debtStatus, formatDate } from './motivation.utils';
import styles from './MotivationPage.module.css';
export default function MotivationEditor({ initial, data, busy, onSave, onClose, asOf }: { initial: MotivationRecord; data: MotivationState; busy: boolean; onSave: (record: MotivationRecord) => Promise<void>; onClose: () => void; asOf: string }) {
  const [record, setRecord] = useState(initial), [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const set = <K extends keyof MotivationRecord>(key: K, value: MotivationRecord[K]) => setRecord(r => ({ ...r, [key]: value }));
  const debt = debtStatus(record, data.buffer, asOf);
  return <dialog ref={dialog} className={styles.dialog} onCancel={e => { if (busy) e.preventDefault(); else onClose(); }} aria-labelledby="motivation-editor-title"><form onSubmit={async e => { e.preventDefault(); setError(''); try { await onSave(record); } catch (e) { setError(e instanceof Error ? e.message : 'Збереження не виконано'); } }}><div className={styles.sectionHeader}><h2 id="motivation-editor-title">Картка перевірки</h2><button type="button" disabled={busy} aria-label="Закрити картку" onClick={onClose}>✕</button></div><p>Факт і ціль мають однакові одиниці. Більше значення — краще виконання. Для дебіторки використовуйте своєчасність оплат, а суму боргу вкажіть окремо.</p><fieldset disabled={busy} className={styles.formGrid}>
    <label>Агент<select value={record.agent} onChange={e => set('agent', e.target.value)}>{data.agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label>Напрям<select value={record.direction} onChange={e => set('direction', e.target.value as MotivationDirection)}>{directions.map(d => <option key={d}>{d}</option>)}</select></label>
    <label>Маршрут<input required maxLength={200} value={record.route} onChange={e => set('route', e.target.value)}/></label>
    <label>Дата результату<input type="date" required value={record.date} onChange={e => set('date', e.target.value)} onInput={e => set('date', e.currentTarget.value)}/></label>
    <label>Факт<input type="number" step="any" min="0" required={record.status === 'підтверджено'} value={record.actual ?? ''} onChange={e => set('actual', e.target.value === '' ? null : Number(e.target.value))}/></label>
    <label>Ціль<input type="number" step="any" min="0.000001" required={record.status === 'підтверджено'} value={record.target ?? ''} onChange={e => set('target', e.target.value === '' ? null : Number(e.target.value))}/></label>
    <label>Статус<select value={record.status} onChange={e => set('status', e.target.value as MotivationStatus)}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label>
    <label>Відповідальний<input maxLength={200} required={record.status === 'підтверджено'} value={record.owner} onChange={e => set('owner', e.target.value)}/></label>
    <label className={styles.full}>Джерело підтвердження<input maxLength={2000} placeholder="Посилання, назва документа або номер звіту" required={record.status === 'підтверджено'} value={record.evidence} onChange={e => set('evidence', e.target.value)}/></label>
    <label className={styles.full}>Невирішене питання<textarea maxLength={2000} value={record.issue} onChange={e => set('issue', e.target.value)}/></label>
    <label>Повторна перевірка<input type="date" value={record.recheck} onChange={e => set('recheck', e.target.value)} onInput={e => set('recheck', e.currentTarget.value)}/></label>
    <label>Примітка<input maxLength={2000} value={record.note} onChange={e => set('note', e.target.value)}/></label>
    {record.direction === 'Дебіторка' && <><h3 className={styles.full}>Індивідуальні умови оплати · буфер +{data.buffer} днів</h3><label>Дата накладної<input type="date" value={record.invoiceDate} onChange={e => set('invoiceDate', e.target.value)} onInput={e => set('invoiceDate', e.currentTarget.value)}/></label><label>Погоджений строк, днів<input type="number" min="0" max="365" step="1" value={record.term} onChange={e => set('term', Number(e.target.value))}/></label><label>Залишок боргу, грн<input type="number" step="any" value={record.balance} onChange={e => set('balance', e.target.value === '' ? '' : Number(e.target.value))}/></label><p className={styles.full}>{debt.label}. {debt.due && `Строк: ${formatDate(debt.due)}; межа буфера: ${formatDate(debt.criticalDate)}. Станом на ${formatDate(asOf)}.`}</p></>}
  </fieldset>{error && <p role="alert" className={styles.errorText}>{error}</p>}<div className={styles.actions}><button type="button" disabled={busy} onClick={onClose}>Скасувати</button><button type="submit" className={styles.primary} disabled={busy}>{busy ? 'Зберігаємо…' : 'Зберегти результат'}</button></div></form></dialog>;
}
