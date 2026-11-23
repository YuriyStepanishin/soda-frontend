import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '../../api/config';
import EquipmentPage from '../EquipmentPage/EquipmentPage';
import AppDialog from '../Navigation/AppDialog';
import PriceDirectory, { type PriceSnapshot } from './PriceDirectory';
import styles from './DictionaryEditor.module.css';

type Kind = 'products' | 'routes';
const pageSize = 20;
const editableRouteDays = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ'];
type RecordValue = string | number | null;
type Entry = { id: number; is_seasonal?: boolean; [key: string]: RecordValue | boolean | undefined };
const filterFields: Record<Kind, { key: string; label: string; text?: boolean }[]> = {
  products: [{ key: 'manufacturer', label: 'Виробник' }, { key: 'tm', label: 'ТМ' }, { key: 'group_name', label: 'Група' }, { key: 'subgroup', label: 'Підгрупа' }, { key: 'packaging', label: 'Фасовка' }],
  routes: [{ key: 'agent_name', label: 'Торговий представник' }, { key: 'route_day', label: 'День тижня' }],
};
const fields: Record<Kind, { key: string; label: string }[]> = {
  products: [
    { key: 'product_name', label: 'Товар' }, { key: 'manufacturer', label: 'Виробник' },
    { key: 'tm', label: 'ТМ' }, { key: 'group_name', label: 'Група' },
    { key: 'subgroup', label: 'Підгрупа' }, { key: 'packaging', label: 'Фасовка' },
  ],
  routes: [
    { key: 'agent_name', label: 'Торговий представник' }, { key: 'route_day', label: 'Дні відвідування' },
    { key: 'store_name', label: 'Торгова точка' },
  ],
};
const routeFields = ['agent_name', 'route_day', 'stop_order', 'store_code', 'store_name', 'is_seasonal'];
const customProductFields = new Set(['manufacturer', 'tm', 'group_name', 'subgroup']);
async function request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(new URL(path, API_BASE_URL), {
    method, headers: { Authorization: 'Bearer ' + localStorage.getItem(AUTH_TOKEN_KEY), 'x-tenant-id': 'laska', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.message || 'Помилка сервера');
  return json as T;
}

function loadPrice(signal: AbortSignal) {
  return request<PriceSnapshot>('/api/laska/dictionary/price', 'GET', undefined, signal);
}

export default function Dictionaries({ email, canEdit }: { email: string; canEdit: boolean }) {
  const [selected, setSelected] = useState<Kind | 'equipment' | 'price'>(canEdit ? 'products' : 'equipment');
  const kind = canEdit || selected === 'price' ? selected : 'equipment';

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
        <button type="button" aria-pressed={kind === 'price'} onClick={() => setSelected('price')}>Прайс</button>
      </nav>
      {kind === 'equipment' && <EquipmentPage email={email} />}
      {kind === 'price' && <PriceDirectory loadPrice={loadPrice} />}
      {(kind === 'products' || kind === 'routes') && <DictionaryEditor key={kind} kind={kind} />}
    </section>
  );
}

function DictionaryEditor({ kind }: { kind: Kind }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [optionsStatus, setOptionsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [optionsRetry, setOptionsRetry] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [includeSeasonal, setIncludeSeasonal] = useState(false);
  const [page, setPage] = useState(1);
  const [loadedPage, setLoadedPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [customValues, setCustomValues] = useState<Partial<Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setOptionsStatus('loading');
    void request<Record<string, string[]>>(`/api/admin/dictionaries/${kind}/filters`, 'GET', undefined, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return;
        setOptions(data);
        setOptionsStatus('ready');
      })
      .catch(() => { if (!controller.signal.aborted) setOptionsStatus('error'); });
    return () => controller.abort();
  }, [kind, optionsRetry, refresh]);
  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true); setError('');
    if (page === 1) {
      setLoadedPage(0);
      setRows([]);
    }
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      pageSize: String(pageSize),
    });
    for (const [field, value] of Object.entries(filters)) {
      if (!value) continue;
      if (kind === 'products' && value === 'empty') params.append('empty', field);
      else params.set(field, kind === 'products' ? value.slice('value:'.length) : value);
    }
    if (kind === 'routes' && includeSeasonal) params.set('includeSeasonal', 'true');
    try {
      const result = await request<{ rows: Entry[]; total: number }>(`/api/admin/dictionaries/${kind}?${params}`, 'GET', undefined, signal);
      if (signal.aborted) return;
      setRows(previous => page === 1 ? result.rows : [...previous, ...result.rows]);
      setLoadedPage(page);
      setTotal(result.total);
    } catch (e) { if (!signal.aborted) setError(e instanceof Error ? e.message : 'Помилка'); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [kind, query, page, filters, includeSeasonal]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refresh]);
  const openEditor = (row: Entry) => {
    setCustomValues({});
    setError('');
    setEditing(row);
  };
  const newEntry = () => {
    const row: Entry = { id: 0 };
    for (const field of fields[kind]) row[field.key] = '';
    if (kind === 'routes') {
      row.stop_order = 1;
      row.store_code = '';
    }
    openEditor(row);
  };
  const save = async () => {
    if (!editing) return;
    const productValues = Object.entries(customValues);
    if (productValues.some(([, value]) => !value?.trim())) {
      setError('Введіть нове значення або виберіть варіант зі списку.');
      return;
    }
    setSaving(true); setError('');
    try {
      const keys = kind === 'routes' ? routeFields : fields[kind].map(field => field.key);
      const data = Object.fromEntries(keys.map(key => [key, editing[key]]));
      for (const [key, value] of productValues) data[key] = value?.trim();
      if (!editing.id && data.is_seasonal === false) delete data.is_seasonal;
      await request(`/api/admin/dictionaries/${kind}${editing.id ? '/' + editing.id : ''}`, editing.id ? 'PUT' : 'POST', data);
      setEditing(null);
      setPage(1);
      setRefresh(value => value + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Не вдалося зберегти'); }
    finally { setSaving(false); }
  };
  const remove = async (row: Entry) => {
    setDeleting(true);
    setError('');
    try {
      await request(`/api/admin/dictionaries/${kind}/${row.id}`, 'DELETE');
      setPage(1);
      setRefresh(value => value + 1);
      setPendingDelete(null);
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Помилка видалення'); }
    finally { setDeleting(false); }
  };
  return <>
    <div className={styles.tools}><input aria-label="Пошук" placeholder="Пошук за назвою..." value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}/><button onClick={newEntry}>+ Додати</button></div>
    {kind === 'routes' && <label className={styles.seasonalToggle}>
      <input type="checkbox" role="switch" checked={includeSeasonal} onChange={event => {
        setIncludeSeasonal(event.currentTarget.checked);
        setPage(1);
      }} />
      Показати сезонних клієнтів
    </label>}
    <div className={styles.filterBar}><button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(open => !open)}>Фільтри {Object.values(filters).filter(Boolean).length ? '(' + Object.values(filters).filter(Boolean).length + ')' : ''} {filtersOpen ? '▴' : '▾'}</button><button type="button" onClick={() => { setFilters({}); setQuery(''); setPage(1); }}>Скинути фільтри</button></div>
    {filtersOpen && <div className={styles.filterPanel}>{filterFields[kind].map(field => <label key={field.key}>{field.label}{field.text
      ? <input value={filters[field.key] || ''} placeholder="Код торгової точки" onChange={e => { setFilters(prev => ({ ...prev, [field.key]: e.target.value })); setPage(1); }} />
      : <select value={filters[field.key] || ''} onChange={event => {
        const value = event.currentTarget.value;
        setFilters(prev => ({ ...prev, [field.key]: value }));
        setPage(1);
      }}>
        <option value="" aria-label="Усі значення">{kind === 'routes' ? 'Усі' : ''}</option>
        {kind === 'products' && <option value="empty">Пусто</option>}
        {kind === 'routes' && field.key === 'route_day' && <option value="__none__">(пусто)</option>}
        {(options[field.key] || []).map(value => <option key={value} value={kind === 'products' ? 'value:' + value : value}>{value}</option>)}
      </select>
    }</label>)}</div>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <p>{loading ? 'Завантаження…' : `Знайдено: ${total}`}</p>
    <div className={styles.list}>{rows.map(row => <article key={row.id} className={styles.item}>
      <div><strong>{String(row[kind === 'products' ? 'product_name' : 'store_name'] ?? '')}</strong><small>{kind === 'products' ? [{ label: 'Виробник', value: row.manufacturer }, { label: 'ТМ', value: row.tm }, { label: 'Група', value: row.group_name }, { label: 'Підгрупа', value: row.subgroup }, { label: 'Фасовка', value: row.packaging }].map(({ value }) => value == null || String(value).trim() === '' ? '' : String(value)).filter(Boolean).join(' · ') : [row.agent_name, row.route_day, '№ ' + row.stop_order, row.store_code, row.is_seasonal && 'Сезонний клієнт'].filter(Boolean).join(' · ')}</small></div>
      <div className={styles.actions}><button onClick={() => openEditor({ ...row })}>Редагувати</button><button className={styles.danger} onClick={() => setPendingDelete(row)}>Видалити</button></div>
    </article>)}</div>
    {loadedPage > 0 && loadedPage * pageSize < total && <div className={styles.pager}>
      <button type="button" disabled={loading} onClick={() => {
        setLoading(true);
        if (page === loadedPage + 1) setRefresh(value => value + 1);
        else setPage(loadedPage + 1);
      }}>{loading && page > 1 ? 'Завантаження…' : 'Показати ще'}</button>
    </div>}
    {pendingDelete && <AppDialog title="Видалити запис?" message={`Запис «${String(pendingDelete[kind === 'products' ? 'product_name' : 'store_name'] ?? '')}» буде видалено назавжди. Цю дію неможливо скасувати.`} onClose={() => setPendingDelete(null)} onConfirm={() => void remove(pendingDelete)} confirmLabel="Видалити" destructive busy={deleting} />}
    {editing && <div className={styles.overlay} role="presentation"><section className={styles.dialog} role="dialog" aria-modal="true" aria-label="Редагування довідника">
      <h2>{editing.id ? 'Редагування' : 'Новий запис'}</h2>
      {kind === 'products' && optionsStatus === 'loading' && <p role="status">Завантаження варіантів…</p>}
      {kind === 'products' && optionsStatus === 'error' && <p role="alert">
        Не вдалося завантажити варіанти.{' '}
        <button type="button" onClick={() => setOptionsRetry(value => value + 1)}>Повторити</button>
      </p>}
      {fields[kind].map(f => {
        if (kind === 'products' && f.key !== 'product_name') {
          const current = String(editing[f.key] ?? '');
          const choices = options[f.key] ?? [];
          const draft = customValues[f.key];
          const selection = draft !== undefined ? 'new' : current ? 'value:' + current : '';
          return <div key={f.key}>
            <label>{f.label}<select value={selection} disabled={optionsStatus !== 'ready' || saving} onChange={event => {
              const value = event.currentTarget.value;
              if (value === 'new') {
                setCustomValues(previous => ({ ...previous, [f.key]: '' }));
                return;
              }
              setCustomValues(previous => {
                const next = { ...previous };
                delete next[f.key];
                return next;
              });
              const selected = value ? value.slice('value:'.length) : null;
              setEditing(previous => previous ? { ...previous, [f.key]: selected } : previous);
            }}>
              <option value="">Не вказано</option>
              {current && !choices.includes(current) && <option value={'value:' + current}>{current}</option>}
              {choices.map(value => <option key={value} value={'value:' + value}>{value}</option>)}
              {customProductFields.has(f.key) && <option value="new">Нове значення…</option>}
            </select></label>
            {draft !== undefined && <label>Нове значення · {f.label}<input
              type="text"
              value={draft}
              maxLength={500}
              disabled={saving}
              onChange={event => {
                const value = event.currentTarget.value;
                setCustomValues(previous => ({ ...previous, [f.key]: value }));
              }}
            /></label>}
          </div>;
        }
        if (kind === 'routes' && f.key === 'route_day') return <fieldset key={f.key} className={styles.dayField}>
          <legend>Дні маршруту (можна вибрати декілька або жодного)</legend>
          <div className={styles.dayChoices}>{editableRouteDays.map(day => {
            const selected = String(editing.route_day ?? '').split(',').map(value => value.trim()).includes(day);
            return <label key={day}><input type="checkbox" checked={selected} onChange={event => {
              const checked = event.currentTarget.checked;
              setEditing(prev => {
                if (!prev) return prev;
                const current = String(prev.route_day ?? '').split(',').map(value => value.trim());
                const days = editableRouteDays.filter(value => value === day ? checked : current.includes(value));
                return { ...prev, route_day: days.join(', ') };
              });
            }}/>{day}</label>;
          })}</div>
        </fieldset>;
        return <label key={f.key}>{f.label}<input type="text" value={String(editing[f.key] ?? '')} onChange={event => {
          const value = event.currentTarget.value;
          setEditing(prev => prev ? { ...prev, [f.key]: value } : prev);
        }}/></label>;
      })}
      {kind === 'routes' && <label className={styles.seasonalToggle}>
        <input type="checkbox" role="switch" checked={editing.is_seasonal === true} onChange={event => {
          const checked = event.currentTarget.checked;
          setEditing(prev => prev ? { ...prev, is_seasonal: checked } : prev);
        }} />
        Сезонний клієнт
      </label>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}><button disabled={saving} onClick={() => setEditing(null)}>Скасувати</button><button disabled={saving} onClick={() => void save()}>{saving ? 'Збереження…' : 'Зберегти'}</button></div>
    </section></div>}
  </>;
}
