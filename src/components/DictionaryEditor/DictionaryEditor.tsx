import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '../../api/config';
import styles from './DictionaryEditor.module.css';

type Kind = 'products' | 'routes';
type RecordValue = string | number | null;
type Entry = { id: number; [key: string]: RecordValue };
const fields: Record<Kind, { key: string; label: string }[]> = {
  products: [
    { key: 'product_name', label: 'Товар' }, { key: 'manufacturer', label: 'Виробник' },
    { key: 'tm', label: 'ТМ' }, { key: 'group_name', label: 'Група' },
    { key: 'subgroup', label: 'Підгрупа' }, { key: 'packaging', label: 'Фасовка' },
  ],
  routes: [
    { key: 'agent_name', label: 'Торговий представник' }, { key: 'route_day', label: 'День (ПН–НД)' },
    { key: 'stop_order', label: 'Порядок' }, { key: 'store_code', label: 'Код ТТ' },
    { key: 'store_name', label: 'Торгова точка' },
  ],
};
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(new URL(path, API_BASE_URL), {
    method, headers: { Authorization: 'Bearer ' + localStorage.getItem(AUTH_TOKEN_KEY), 'x-tenant-id': 'laska', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message || 'Помилка сервера');
  return json as T;
}
export default function DictionaryEditor({ onBack }: { onBack: () => void }) {
  const [kind, setKind] = useState<Kind>('products');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await request<{ rows: Entry[]; total: number }>(`/api/admin/dictionaries/${kind}?q=${encodeURIComponent(query)}&page=${page}`);
      setRows(result.rows); setTotal(result.total);
    } catch (e) { setError(e instanceof Error ? e.message : 'Помилка'); }
    finally { setLoading(false); }
  }, [kind, query, page]);
  useEffect(() => { void load(); }, [load]);
  const changeKind = (next: Kind) => { setKind(next); setQuery(''); setPage(1); setEditing(null); };
  const newEntry = () => {
    const row: Entry = { id: 0 };
    for (const field of fields[kind]) row[field.key] = field.key === 'stop_order' ? 1 : '';
    setEditing(row);
  };
  const save = async () => {
    if (!editing) return;
    setSaving(true); setError('');
    try {
      const data = Object.fromEntries(fields[kind].map(f => [f.key, editing[f.key]]));
      await request(`/api/admin/dictionaries/${kind}${editing.id ? '/' + editing.id : ''}`, editing.id ? 'PUT' : 'POST', data);
      setEditing(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Не вдалося зберегти'); }
    finally { setSaving(false); }
  };
  const remove = async (row: Entry) => {
    if (!window.confirm('Видалити запис назавжди? Цю дію неможливо скасувати.')) return;
    setError('');
    try { await request(`/api/admin/dictionaries/${kind}/${row.id}`, 'DELETE'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Помилка видалення'); }
  };
  return <main className={styles.main}>
    <header className={styles.header}><button onClick={onBack}>← Назад</button><h1>Редактор довідників</h1></header>
    <div className={styles.tabs}><button aria-pressed={kind === 'products'} onClick={() => changeKind('products')}>Товари</button><button aria-pressed={kind === 'routes'} onClick={() => changeKind('routes')}>Маршрути</button></div>
    <div className={styles.tools}><input aria-label="Пошук" placeholder="Пошук за назвою..." value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}/><button onClick={newEntry}>+ Додати</button></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <p>{loading ? 'Завантаження…' : `Знайдено: ${total}`}</p>
    <div className={styles.list}>{rows.map(row => <article key={row.id} className={styles.item}>
      <div><strong>{String(row[kind === 'products' ? 'product_name' : 'store_name'] ?? '')}</strong><small>{kind === 'products' ? [row.tm, row.group_name, row.packaging].filter(Boolean).join(' · ') : [row.agent_name, row.route_day, '№ ' + row.stop_order, row.store_code].filter(Boolean).join(' · ')}</small></div>
      <div className={styles.actions}><button onClick={() => setEditing({ ...row })}>Редагувати</button><button className={styles.danger} onClick={() => void remove(row)}>Видалити</button></div>
    </article>)}</div>
    <div className={styles.pager}><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Назад</button><span>Сторінка {page}</span><button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>Далі →</button></div>
    {editing && <div className={styles.overlay} role="presentation"><section className={styles.dialog} role="dialog" aria-modal="true" aria-label="Редагування довідника">
      <h2>{editing.id ? 'Редагування' : 'Новий запис'}</h2>
      {fields[kind].map(f => <label key={f.key}>{f.label}<input type={f.key === 'stop_order' ? 'number' : 'text'} value={editing[f.key] ?? ''} onChange={e => setEditing(prev => prev ? { ...prev, [f.key]: f.key === 'stop_order' ? Number(e.target.value) : e.target.value } : prev)}/></label>)}
      {error && <p role="alert" className={styles.error}>{error}</p>}\n      <div className={styles.actions}><button disabled={saving} onClick={() => setEditing(null)}>Скасувати</button><button disabled={saving} onClick={() => void save()}>{saving ? 'Збереження…' : 'Зберегти'}</button></div>
    </section></div>}
  </main>;
}
