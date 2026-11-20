import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../api/client';
import styles from './EquipmentPage.module.css';

type Equipment = {
  route_code: string | null;
  agent_name: string | null;
  store_code: string;
  store_name: string;
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

const numberFormat = new Intl.NumberFormat('uk-UA');

function formatNumber(value: string | null) {
  return value === null ? '—' : numberFormat.format(Number(value));
}

export default function EquipmentPage({ email }: { email: string }) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['equipment', 'laska', email, search, page],
    queryFn: ({ signal }) => apiGet<{ rows: Equipment[]; hasNext: boolean }>(
      '/api/laska/equipment', { authenticated: true, query: { search, page }, signal },
    ),
  });

  return (
    <section className={styles.page}>
      <h1>Обладнання торгових точок</h1>
      <form className={styles.search} onSubmit={event => {
        event.preventDefault();
        setSearch(input.trim());
        setPage(1);
      }}>
        <label>
          Пошук обладнання
          <input type="search" value={input} maxLength={160}
            placeholder="Назва ТТ, код, серійний номер або ПТТ"
            onChange={event => setInput(event.target.value)} />
        </label>
        <button type="submit">Знайти</button>
      </form>

      {isPending && <p role="status">Завантажую довідник…</p>}
      {isError && <div role="alert">
        <p>Не вдалося завантажити довідник.</p>
        <button type="button" onClick={() => void refetch()}>Повторити</button>
      </div>}
      {data && data.rows.length === 0 && <p role="status">Записів не знайдено.</p>}
      {data && data.rows.length > 0 && (
        <div className={styles.cards}>
          {data.rows.map(row => (
            <article className={styles.card} key={JSON.stringify([row.source_file_id, row.source_sheet, row.source_row])}>
              <h2>{row.equipment_name}</h2>
              <p>{row.store_name} · {row.store_code}</p>
              <p>{[row.route_code, row.agent_name].filter(Boolean).join(' · ')}</p>
              <dl>
                <div><dt>Серійний номер</dt><dd>{row.serial_number || '—'}</dd></div>
                <div><dt>Власник</dt><dd>{row.ownership_label || '—'}</dd></div>
                <div><dt>Об’єм, л</dt><dd>{formatNumber(row.volume_liters)}</dd></div>
                <div><dt>Наявність</dt><dd>{row.is_present === null ? '—' : row.is_present ? 'Є' : 'Немає'}</dd></div>
                <div><dt>Договір</dt><dd>{[row.contract_number, row.contract_date?.split('-').reverse().join('.')].filter(Boolean).join(' · ') || '—'}</dd></div>
                <div><dt>Вартість за довідником</dt><dd>{formatNumber(row.recorded_value)}</dd></div>
              </dl>
            </article>
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
