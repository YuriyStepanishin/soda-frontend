import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../api/client';
import styles from './EquipmentPage.module.css';

type Equipment = {
  route_code: string | null;
  agent_name: string | null;
  equipment_name: string;
  serial_number: string | null;
  ownership_label: string | null;
  volume_liters: string | null;
  is_present: boolean | null;
  contract_date: string | null;
  contract_number: string | null;
  recorded_value: string | null;
  source_file_id: string;
  source_sheet: string;
  source_row: number;
};

type Store = {
  store_code: string;
  store_name: string | null;
  routes: string[] | null;
  equipment: Equipment[];
};

type Presence = 'all' | 'present' | 'absent' | 'unknown';
type EquipmentDirectory = { stores: Store[]; routes: string[]; hasNext: boolean };

const numberFormat = new Intl.NumberFormat('uk-UA');

function formatNumber(value: string | null) {
  return value === null ? '—' : numberFormat.format(Number(value));
}

export default function EquipmentPage({ email }: { email: string }) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [route, setRoute] = useState('');
  const [presence, setPresence] = useState<Presence>('all');
  const [page, setPage] = useState(1);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['equipment-stores', 'laska', email, search, route, presence, page],
    queryFn: ({ signal }) => apiGet<EquipmentDirectory>(
      '/api/laska/equipment/stores', { authenticated: true, query: { search, route, presence, page }, signal },
    ),
  });

  return (
    <section aria-label="Обладнання торгових точок">
      <form className={styles.search} onSubmit={event => {
        event.preventDefault();
        setSearch(input.trim());
        setPage(1);
      }}>
        <label>
          Пошук торгової точки
          <input type="search" value={input} maxLength={160}
            placeholder="Назва ТТ, код або серійний номер"
            onChange={event => setInput(event.target.value)} />
        </label>
        <label>
          Маршрут
          <select value={route} onChange={event => {
            setRoute(event.target.value);
            setPage(1);
          }}>
            <option value="">Усі маршрути</option>
            {[...new Set([route, ...(data?.routes ?? [])].filter(Boolean))].map(value => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Наявність обладнання
          <select value={presence} onChange={event => {
            setPresence(event.target.value as Presence);
            setPage(1);
          }}>
            <option value="all">Усі записи</option>
            <option value="present">Є в точці</option>
            <option value="absent">Відсутнє</option>
            <option value="unknown">Не вказано</option>
          </select>
        </label>
        <button type="submit">Знайти</button>
        {(input || search || route || presence !== 'all') && (
          <button type="button" onClick={() => {
            setInput('');
            setSearch('');
            setRoute('');
            setPresence('all');
            setPage(1);
          }}>Скинути</button>
        )}
      </form>

      {isPending && <p role="status">Завантажую довідник…</p>}
      {isError && <div role="alert">
        <p>Не вдалося завантажити довідник.</p>
        <button type="button" onClick={() => void refetch()}>Повторити</button>
      </div>}
      {data?.stores.length === 0 && <p role="status">Торгових точок не знайдено.</p>}
      {data && data.stores.length > 0 && (
        <div className={styles.stores}>
          {data.stores.map(store => (
            <details key={store.store_code} className={styles.store}>
              <summary>
                <span className={styles.storeIdentity}>
                  <strong>{store.store_name || store.store_code}</strong>
                  <small>{[store.store_code, ...(store.routes ?? [])].join(' · ')}</small>
                </span>
                <span className={styles.count}>{numberFormat.format(store.equipment.length)} од.</span>
              </summary>
              <div className={styles.cards}>
                {store.equipment.map(row => (
                  <article className={styles.card} key={JSON.stringify([row.source_file_id, row.source_sheet, row.source_row])}>
                    <h2>{row.equipment_name}</h2>
                    <p>{[row.route_code, row.agent_name].filter(Boolean).join(' · ')}</p>
                    <dl>
                      <div><dt>Серійний номер</dt><dd>{row.serial_number || '—'}</dd></div>
                      <div><dt>Власник</dt><dd>{row.ownership_label || '—'}</dd></div>
                      <div><dt>Об’єм, л</dt><dd>{formatNumber(row.volume_liters)}</dd></div>
                      <div><dt>Наявність</dt><dd>{row.is_present === null ? 'Не вказано' : row.is_present ? 'Є' : 'Немає'}</dd></div>
                      <div><dt>Договір</dt><dd>{[row.contract_number, row.contract_date?.split('-').reverse().join('.')].filter(Boolean).join(' · ') || '—'}</dd></div>
                      <div><dt>Вартість за довідником</dt><dd>{formatNumber(row.recorded_value)}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
      {(page > 1 || data?.hasNext) && (
        <nav className={styles.pagination} aria-label="Сторінки довідника">
          <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Попередня</button>
          <span aria-live="polite">Сторінка {page}</span>
          <button type="button" disabled={!data?.hasNext} onClick={() => setPage(page + 1)}>Наступна</button>
        </nav>
      )}
    </section>
  );
}
