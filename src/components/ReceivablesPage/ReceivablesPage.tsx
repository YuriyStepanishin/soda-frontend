import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAuthSession } from '../../api/auth';
import { fetchReceivables, importReceivables, type DebtFilters, type DebtStatus } from '../../api/receivables';
import Loader from '../Loader/Loader';
import styles from './ReceivablesPage.module.css';
const labels: Record<DebtStatus, string> = { current: 'Поточна', overdue: 'Прострочка 14+', penalty: 'Штраф ТП 21+', prepayment: 'Переплата' };
const currency = (value: number) => new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(value);
const shortDate = (date: string) => date.split('-').reverse().join('.');
export default function ReceivablesPage({ onBack }: { onBack: () => void }) {
  const user = getAuthSession()?.user;
  const canImport = ['admin', 'manager'].includes(user?.role ?? '');
  const [filters, setFilters] = useState<DebtFilters>({agent:'',route:'',search:'',status:'',page:1});
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
  const change = (field: keyof DebtFilters, value: string) => setFilters(previous => ({...previous,[field]:value,page:1}));
  const data = query.data;
  const agents = [...new Set(data?.options.map(option => option.agent).filter((agent): agent is string => !!agent))].sort();
  const routes = [...new Set(data?.options.filter(option => !filters.agent || option.agent === filters.agent).map(option => option.route))].sort();
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
    <form className={styles.filters} onSubmit={event => {event.preventDefault();change('search',search.trim());}}>
      {user?.role !== 'agent' && <label>Торговий агент<select value={filters.agent} onChange={event => setFilters(previous => ({...previous,agent:event.target.value,route:'',page:1}))}><option value="">Усі доступні</option>{agents.map(agent => <option key={agent}>{agent}</option>)}</select></label>}
      <label>ПТТ<select value={filters.route} onChange={event => change('route',event.target.value)}><option value="">Усі доступні</option>{routes.map(route => <option key={route}>{route}</option>)}</select></label>
      <label>Статус<select value={filters.status} onChange={event => change('status',event.target.value)}><option value="">Усі статуси</option>{Object.entries(labels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className={styles.search}>ТТ або накладна<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Назва ТТ або номер" maxLength={200} /></label><button type="submit">Знайти</button>
    </form>
    {query.isPending ? <Loader /> : data && !data.metadata ? <p className={styles.empty}>Дебіторку ще не імпортовано. Завантажте файл «8.xlsx» у папку дебіторки на Google Drive.</p> : data && <>
      <p className={styles.hint}>Накладних за фільтром: {data.pagination.total} · ТТ за пошуком: {data.totals.stores}</p>
      <div className={styles.tableWrap}><table><thead><tr><th>ТТ / ТА / ПТТ</th><th>Накладна</th><th>Дата</th><th>Днів</th><th>Статус</th><th>Сума документа</th><th>Сальдо</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.id} className={styles[row.status]}>
        <td><strong>{row.store}</strong><small>{row.agent || 'Агента не зіставлено'} · {row.route}{row.network ? ' · Мережа' : ''}</small></td>
        <td>{row.number}{row.type === 'return' && <small>Повернення</small>}</td><td>{shortDate(row.date)}</td><td>{row.days}</td><td>{labels[row.status]}</td><td className={styles.amount}>{row.amount === null ? '—' : currency(row.amount)}</td><td className={styles.amount}><strong>{currency(row.balance)}</strong></td>
      </tr>)}</tbody></table>{!data.rows.length && <p className={styles.empty}>За цими фільтрами накладних немає.</p>}</div>
      <nav className={styles.pagination} aria-label="Сторінки дебіторки"><button type="button" disabled={filters.page<=1 || query.isFetching} onClick={() => setFilters(value => ({...value,page:value.page-1}))}>Назад</button><span>{data.pagination.page} / {Math.max(1,data.pagination.pages)}</span><button type="button" disabled={filters.page>=data.pagination.pages || query.isFetching} onClick={() => setFilters(value => ({...value,page:value.page+1}))}>Далі</button></nav>
    </>}
  </main>;
}
