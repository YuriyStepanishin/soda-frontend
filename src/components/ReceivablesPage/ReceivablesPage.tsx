import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAuthSession } from '../../api/auth';
import { fetchReceivables, importReceivables, type DebtFilters, type DebtStatus, type DebtRepresentative, type Receivable } from '../../api/receivables';
import Loader from '../Loader/Loader';
import styles from './ReceivablesPage.module.css';
const labels: Record<DebtStatus, string> = { current: 'Поточна', overdue: 'Прострочка 14+', penalty: 'Штраф ТП 21+', prepayment: 'Переплата' };
const currency = (value: number) => new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(value);
const shortDate = (date: string) => date.split('-').reverse().join('.');
const representativeKey = (option: DebtRepresentative) => JSON.stringify([option.agent, option.route]);
const allStatuses = Object.keys(labels) as DebtStatus[];
function groupInvoices(rows: Receivable[]) {
  const groups = new Map<string, {key: string; store: string; agent: string | null; route: string; network: boolean; rows: Receivable[]}>();
  for (const row of rows) {
    const key = JSON.stringify([row.agent, row.route, row.store]);
    if (!groups.has(key)) groups.set(key, {key, store:row.store, agent:row.agent, route:row.route, network:row.network, rows:[]});
    groups.get(key)!.rows.push(row);
  }
  return [...groups.values()];
}
export default function ReceivablesPage({ onBack }: { onBack: () => void }) {
  const user = getAuthSession()?.user;
  const canImport = ['admin', 'manager'].includes(user?.role ?? '');
  const [filters, setFilters] = useState<DebtFilters>({representatives:[],search:'',statuses:allStatuses,page:1});
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const queryClient = useQueryClient();
  const key = ['receivables', 'laska', user?.email ?? getAuthSession()?.email];
  const query = useQuery({queryKey:[...key, filters],queryFn:({signal}) => fetchReceivables(filters, signal),
    staleTime:0,refetchInterval:60000,refetchOnWindowFocus:true});
  const importer = useMutation({mutationFn:importReceivables,onSuccess:async result => {
    setNotice(result.skippedOlder ? 'Файл старіший за дані в Neon. Поточні залишки збережені.' :
      result.processed ? `Таблицю оновлено: ${result.inserted} накладних.` : '');
    if (result.cleanupErrors?.length) setNotice(value => value + ' Дані збережені, але файл поки залишився у папці завантажень.');
    await queryClient.invalidateQueries({queryKey:key});
  }});
  const toggleRepresentative = (option: DebtRepresentative) => setFilters(previous => ({...previous,page:1,
    representatives: previous.representatives.some(value => representativeKey(value) === representativeKey(option))
      ? previous.representatives.filter(value => representativeKey(value) !== representativeKey(option)) : [...previous.representatives, option]}));
  const toggleStatus = (status: DebtStatus) => setFilters(previous => ({...previous,page:1,
    statuses: previous.statuses.includes(status) ? previous.statuses.filter(value => value !== status) : [...previous.statuses,status]}));
  const data = query.data;
  const representatives = data?.options ?? [];
  const groups = groupInvoices(data?.rows ?? []);
  return <main className={styles.page}>
    <header className={styles.header}><div><button type="button" className={styles.back} onClick={onBack}>← Головна</button><h1>Дебіторка</h1><p>Ласка · поточні залишки за торговими точками</p></div>
      <div className={styles.actions}><button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? 'Оновлення…' : 'Оновити дані'}</button>
      {canImport && <button type="button" disabled={importer.isPending} onClick={() => {setNotice('');importer.mutate();}}>{importer.isPending ? 'Імпортуємо…' : 'Імпортувати з Drive'}</button>}</div></header>
    {(query.error || importer.error) && <p role="alert" className={styles.error}>{(query.error || importer.error)?.message}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {data?.metadata && <p className={styles.updated}>Дані станом на <strong>{shortDate(data.metadata.report_date)}</strong></p>}
    {!!data?.metadata?.unmatched_routes && <p className={styles.notice}>ПТТ без зіставленого агента: {data.metadata.unmatched_routes}. Ці борги доступні керівнику для перевірки.</p>}
    {data && <section className={styles.summary} aria-label="Підсумки дебіторки">
      {[['Сальдо',data.totals.balance],['Борг',data.totals.debt],['Прострочка 14+',data.totals.overdue],['Сальдо 21+',data.totals.penalty],['Штраф ТП · 1%',data.totals.penaltyAmount ?? Math.round(data.totals.penalty * 100 * 0.01) / 100],['Переплата',data.totals.prepayment]].map(([label,value]) => <article key={label}><span>{label}</span><strong>{currency(Number(value))}</strong></article>)}
    </section>}
    <p className={styles.hint}>Штраф ТП — 1% від сальдо 21+ днів. Сальдо 21+ входить у прострочку 14+. Мережі виключені з прострочки та штрафу. Підсумки враховують усі статуси в обраних ТА, ПТТ і пошуку.</p>
    <form className={styles.filters} onSubmit={event => {event.preventDefault();setFilters(previous => ({...previous,search:search.trim(),page:1}));}}>
      <div className={styles.representativeFilter}><span id="representatives-label">Торговий представник/ПТТ</span>
        <details className={styles.picker}><summary>{filters.representatives.length ? `Вибрано: ${filters.representatives.length}` : 'Усі доступні'}<span aria-hidden="true">⌄</span></summary>
          <div className={styles.pickerPanel} role="group" aria-labelledby="representatives-label">
            <button type="button" className={styles.clearFilter} onClick={() => setFilters(previous => ({...previous,representatives:[],page:1}))}>Усі доступні / скинути</button>
            {representatives.map(option => <label className={styles.checkOption} key={representativeKey(option)}>
              <input type="checkbox" checked={filters.representatives.some(value => representativeKey(value) === representativeKey(option))} onChange={() => toggleRepresentative(option)} />
              <span><strong>{option.agent || 'Без представника'}</strong><small>{option.route}</small></span>
            </label>)}
          </div>
        </details>
      </div>
      <label className={styles.search}>ТТ або накладна<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Назва ТТ або номер" maxLength={200} /></label><button type="submit">Знайти</button>
      <fieldset className={styles.statusFilters}><legend>Статуси накладних</legend>
        <label className={styles.statusOption}><input type="checkbox" checked={filters.statuses.length === allStatuses.length} onChange={event => setFilters(previous => ({...previous,statuses:event.target.checked ? allStatuses : [],page:1}))} />Усі</label>
        {allStatuses.map(status => <label key={status} className={`${styles.statusOption} ${styles[status]}`}><input type="checkbox" checked={filters.statuses.includes(status)} onChange={() => toggleStatus(status)} />{labels[status]}</label>)}
      </fieldset>
    </form>
    {query.isPending ? <Loader /> : data && !data.metadata ? <p className={styles.empty}>Дебіторку ще не імпортовано. Завантажте файл «8.xlsx» у папку дебіторки на Google Drive.</p> : data && <>
      <p className={styles.hint}>Накладних за фільтром: {data.pagination.total} · ТТ за пошуком: {data.totals.stores}</p>
      <div className={styles.storeGroups}>{groups.map(group => <section key={group.key} className={styles.storeGroup} aria-label={group.store}>
        <header className={styles.storeHeading}><div><h2>{group.store}</h2><p>{group.agent || 'Агента не зіставлено'} · {group.route}</p></div>{group.network && <span className={styles.network}>Мережа</span>}</header>
        <div className={styles.tableWrap}><table><caption className={styles.srOnly}>Накладні: {group.store}</caption><thead><tr><th scope="col">Накладна</th><th scope="col">Дата</th><th scope="col">Днів</th><th scope="col">Статус</th><th scope="col" className={styles.amount}>Сума документа</th><th scope="col" className={styles.amount}>Сальдо</th></tr></thead><tbody>{group.rows.map(row => <tr key={row.id} className={styles[row.status]}>
          <td data-label="Накладна" className={styles.invoiceNumber}><strong>{row.number}</strong>{row.type === 'return' && <small>Повернення</small>}</td><td data-label="Дата">{shortDate(row.date)}</td><td data-label="Днів">{row.days}</td><td data-label="Статус" className={styles.statusCell}><span>{labels[row.status]}</span></td><td data-label="Сума документа" className={styles.amount}>{row.amount === null ? '—' : currency(row.amount)}</td><td data-label="Сальдо" className={styles.amount}><strong>{currency(row.balance)}</strong></td>
        </tr>)}</tbody></table></div>
      </section>)}{!data.rows.length && <p className={styles.empty}>{!filters.statuses.length ? 'Оберіть хоча б один статус накладних.' : 'За цими фільтрами накладних немає.'}</p>}</div>
      <nav className={styles.pagination} aria-label="Сторінки дебіторки"><button type="button" disabled={filters.page<=1 || query.isFetching} onClick={() => setFilters(value => ({...value,page:value.page-1}))}>Назад</button><span>{data.pagination.page} / {Math.max(1,data.pagination.pages)}</span><button type="button" disabled={filters.page>=data.pagination.pages || query.isFetching} onClick={() => setFilters(value => ({...value,page:value.page+1}))}>Далі</button></nav>
    </>}
  </main>;
}
