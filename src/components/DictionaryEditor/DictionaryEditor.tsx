import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '../../api/config';
import EquipmentPage from '../EquipmentPage/EquipmentPage';
import styles from './DictionaryEditor.module.css';

type Kind = 'products' | 'routes';
const weekdays = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'НД'];
type RecordValue = string | number | null;
type Entry = { id: number; [key: string]: RecordValue };
const filterFields: Record<Kind, { key: string; label: string; text?: boolean }[]> = {
  products: [{ key: 'manufacturer', label: 'Виробник' }, { key: 'tm', label: 'ТМ' }, { key: 'group_name', label: 'Група' }, { key: 'subgroup', label: 'Підгрупа' }, { key: 'packaging', label: 'Фасовка' }],
  routes: [{ key: 'agent_name', label: 'Торговий представник' }, { key: 'route_day', label: 'День тижня' }, { key: 'store_code', label: 'Код ТТ', text: true }],
};
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
export default function Dictionaries({ email, canEdit }: { email: string; canEdit: boolean }) {
  const [selected, setSelected] = useState<Kind | 'equipment'>(canEdit ? 'products' : 'equipment');
  const kind = canEdit ? selected : 'equipment';

  return (
    <section className={styles.main}>
      <header className={styles.header}><h1>Довідники</h1></header>
      <nav className={styles.tabs} aria-label="Довідники ЛАСКА">
        {canEdit && (
          <>
            <button type="button" aria-pressed={kind === 'products'} onClick={() => setSelected('products')}>Товари</button>
            <button type="button" aria-pressed={kind === 'routes'} onClick={() => setSelected('routes')}>Маршрути</button>
          </>
        )}
        <button type="button" aria-pressed={kind === 'equipment'} onClick={() => setSelected('equipment')}>Обладнання</button>
      </nav>
      {kind === 'equipment' ? <EquipmentPage email={email} /> : <DictionaryEditor key={kind} kind={kind} />}
    </section>
  );
}

function DictionaryEditor({ kind }: { kind: Kind }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setOptions({});
    void request<Record<string, string[]>>(`/api/admin/dictionaries/${kind}/filters`)
      .then(data => { if (!cancelled) setOptions(data); })
      .catch(() => { if (!cancelled) setOptions({}); });
    return () => { cancelled = true; };
  }, [kind]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await request<{ rows: Entry[]; total: number }>(`/api/admin/dictionaries/${kind}?${new URLSearchParams({ q: query, page: String(page), ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) })}`);
      setRows(result.rows); setTotal(result.total);
    } catch (e) { setError(e instanceof Error ? e.message : 'Помилка'); }
    finally { setLoading(false); }
  }, [kind, query, page, filters]);
  useEffect(() => { void load(); }, [load]);
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
  return <>
    <div className={styles.tools}><input aria-label="Пошук" placeholder="Пошук за назвою..." value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}/><button onClick={newEntry}>+ Додати</button></div>
    <div className={styles.filterBar}><button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(open => !open)}>Фільтри {Object.values(filters).filter(Boolean).length ? '(' + Object.values(filters).filter(Boolean).length + ')' : ''} {filtersOpen ? '▴' : '▾'}</button><button type="button" onClick={() => { setFilters({}); setQuery(''); setPage(1); }}>Скинути фільтри</button></div>
    {filtersOpen && <div className={styles.filterPanel}>{filterFields[kind].map(field => <label key={field.key}>{field.label}{field.text
      ? <input value={filters[field.key] || ''} placeholder="Код торгової точки" onChange={e => { setFilters(prev => ({ ...prev, [field.key]: e.target.value })); setPage(1); }} />
      : <select value={filters[field.key] || ''} onChange={e => { setFilters(prev => ({ ...prev, [field.key]: e.target.value })); setPage(1); }}><option value="">Усі</option>{(options[field.key] || []).map(value => <option key={value} value={value}>{value}</option>)}</select>
    }</label>)}</div>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <p>{loading ? 'Завантаження…' : `Знайдено: ${total}`}</p>
    <div className={styles.list}>{rows.map(row => <article key={row.id} className={styles.item}>
      <div><strong>{String(row[kind === 'products' ? 'product_name' : 'store_name'] ?? '')}</strong><small>{kind === 'products' ? [row.tm, row.group_name, row.packaging].filter(Boolean).join(' · ') : [row.agent_name, row.route_day, '№ ' + row.stop_order, row.store_code].filter(Boolean).join(' · ')}</small></div>
      <div className={styles.actions}><button onClick={() => setEditing({ ...row })}>Редагувати</button><button className={styles.danger} onClick={() => void remove(row)}>Видалити</button></div>
    </article>)}</div>
    <div className={styles.pager}><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Назад</button><span>Сторінка {page}</span><button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>Далі →</button></div>
    {editing && <div className={styles.overlay} role="presentation"><section className={styles.dialog} role="dialog" aria-modal="true" aria-label="Редагування довідника">
      <h2>{editing.id ? 'Редагування' : 'Новий запис'}</h2>
      {fields[kind].map(f => f.key === 'route_day' && kind === 'routes'
        ? <fieldset key={f.key} className={styles.dayField}><legend>Дні відвідування (можна декілька або жодного)</legend><div className={styles.dayChoices}>{weekdays.map(day => {
          const selected = String(editing.route_day ?? '').split(',').map(x => x.trim()).includes(day);
          return <label key={day}><input type="checkbox" checked={selected} onChange={e => setEditing(prev => {
            if (!prev) return prev;
            const current = String(prev.route_day ?? '').split(',').map(x => x.trim()).filter(Boolean);
            return { ...prev, route_day: weekdays.filter(x => e.target.checked ? (x === day || current.includes(x)) : (x !== day && current.includes(x))).join(', ') };
          })}/>{day}</label>;
        })}</div></fieldset>
        : <label key={f.key}>{f.label}<input type={f.key === 'stop_order' ? 'number' : 'text'} value={editing[f.key] ?? ''} onChange={e => setEditing(prev => prev ? { ...prev, [f.key]: f.key === 'stop_order' ? Number(e.target.value) : e.target.value } : prev)}/></label>)} 
      {error && <p role="alert" className={styles.error}>{error}</p>}\n      <div className={styles.actions}><button disabled={saving} onClick={() => setEditing(null)}>Скасувати</button><button disabled={saving} onClick={() => void save()}>{saving ? 'Збереження…' : 'Зберегти'}</button></div>
    </section></div>}
  </>;
}
