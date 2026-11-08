import { useRef, useState } from 'react';
import {
  fetchMotivationHistory,
  fetchMotivationSnapshot,
} from '../../api/motivation';
import { getAuthSession } from '../../api/auth';
import type {
  MotivationFilters,
  MotivationRecord,
  MotivationState,
  MotivationHistory,
} from '../../types/motivation';
import { useMotivation } from './useMotivation';
import {
  blankRecord,
  newId,
  buildReport,
  downloadFile,
  periods,
  today,
} from './motivation.utils';
import MotivationOverview, { MotivationComparison } from './MotivationOverview';
import MotivationEditor from './MotivationEditor';
import MotivationRecords from './MotivationRecords';
import MotivationSettings from './MotivationSettings';
import styles from './MotivationPage.module.css';
const tabs = [
  'Огляд',
  'Порівняння',
  'Журнал перевірок',
  'Невирішені питання',
  'Модель мотивації',
] as const;
export default function MotivationPage({
  onBack,
  database,
}: {
  onBack: () => void;
  database: string;
}) {
  // Use backend roles, not normalized UI roles: brand_manager must not gain manager access.
  const role = getAuthSession()?.user.role;
  if (database !== 'laska' || !role || !['admin', 'manager'].includes(role))
    return (
      <section className={styles.page}>
        <button onClick={onBack}>← Назад</button>
        <p>Розділ доступний адміністратору та менеджеру Ласки.</p>
      </section>
    );
  return <MotivationWorkspace onBack={onBack} />;
}
function MotivationWorkspace({ onBack }: { onBack: () => void }) {
  const { state, history, mutation } = useMotivation();
  const [tab, setTab] = useState<(typeof tabs)[number]>('Огляд');
  const [filters, setFilters] = useState<MotivationFilters>({
    months: 3,
    end: today(),
    agent: '',
    route: '',
  });
  const [editor, setEditor] = useState<{
    record: MotivationRecord;
    revision: number;
  } | null>(null);
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [report, setReport] = useState('');
  const [imported, setImported] = useState<{
    data: MotivationState;
    revision: number;
    count: number;
  } | null>(null);
  const [extraHistory, setExtraHistory] = useState<MotivationHistory[]>([]),
    [historyBusy, setHistoryBusy] = useState(false);
  const [endHistory, setEndHistory] = useState(false);
  const reportDialog = useRef<HTMLDialogElement>(null);
  const data = state.data?.data,
    revision = state.data?.revision ?? 0;
  async function save(
    next: MotivationState,
    action: string,
    expectedRevision = revision
  ) {
    setError('');
    setMessage('');
    if (new Blob([JSON.stringify(next)]).size > 7500000)
      throw new Error(
        'Загальний обсяг даних перевищує 7,5 МБ. Зверніться до адміністратора.'
      );
    await mutation.mutateAsync({
      data: next,
      revision: expectedRevision,
      action,
    });
    setMessage('Зміни збережено. Історію перевірки оновлено.');
  }
  async function importFile(file: File) {
    try {
      if (file.size > 7000000)
        throw new Error(
          'Максимальний розмір JSON — 7 МБ. Розділіть імпорт на частини.'
        );
      const value: unknown = JSON.parse(await file.text());
      if (Array.isArray(value)) {
        const records = value.map(r => ({ ...r, id: newId() }));
        setImported({
          data: { ...data!, records: [...data!.records, ...records] },
          revision,
          count: records.length,
        });
      } else if (
        value &&
        typeof value === 'object' &&
        'agents' in value &&
        'records' in value &&
        Array.isArray(value.records)
      ) {
        setImported({
          data: value as MotivationState,
          revision,
          count: value.records.length,
        });
      } else
        throw new Error(
          'Оберіть експорт цієї панелі або масив записів за шаблоном.'
        );
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося прочитати файл');
    }
  }
  if (state.isPending)
    return (
      <section className={styles.page}>
        <button onClick={onBack}>← Назад</button>
        <p role="status">Завантаження мотивації…</p>
      </section>
    );
  if (!data || state.isError)
    return (
      <section className={styles.page}>
        <button onClick={onBack}>← Назад</button>
        <p role="alert">{state.error?.message || 'Панель недоступна'}</p>
        <button onClick={() => void state.refetch()}>Спробувати знову</button>
      </section>
    );
  const routeOptions = [...new Set(data.records.map(r => r.route))].sort();
  const range = periods(filters);
  const audit = [...(history.data || []), ...extraHistory].filter(
    (row, index, all) => all.findIndex(other => other.id === row.id) === index
  );
  return (
    <main className={styles.page}>
      <div className={styles.sectionHeader}>
        <div>
          <button type="button" onClick={onBack}>
            ← Головна
          </button>
          <p className={styles.eyebrow}>ЛАСКА · ПІЛОТНИЙ ПРОЄКТ</p>
          <h1>Контроль мотивації</h1>
          <p>
            Підтверджені дані, відповідальні та наступні кроки. Без штрафів.
          </p>
        </div>
        <div className={styles.actions}>
          <button
            disabled={mutation.isPending}
            onClick={() => {
              setReport(buildReport(data, filters));
              reportDialog.current?.showModal();
            }}
          >
            Короткий звіт
          </button>
          <button
            className={styles.primary}
            disabled={mutation.isPending}
            onClick={() => setEditor({ record: blankRecord(), revision })}
          >
            ＋ Додати результат
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" className={styles.success}>
          {message}
        </p>
      )}
      <nav className={styles.tabs} aria-label="Розділи мотивації">
        {tabs.map(t => (
          <button
            type="button"
            key={t}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <section className={styles.filters} aria-label="Фільтри мотивації">
        <label>
          Період
          <select
            value={filters.months}
            onChange={e =>
              setFilters({ ...filters, months: Number(e.target.value) })
            }
          >
            {[3, 4, 5, 6].map(m => (
              <option key={m} value={m}>
                {m} міс.
              </option>
            ))}
          </select>
        </label>
        <label>
          Станом на
          <input
            type="date"
            required
            value={filters.end}
            onChange={e => {
              if (e.target.value)
                setFilters({ ...filters, end: e.target.value });
            }}
            onInput={e => {
              if (e.currentTarget.value)
                setFilters({ ...filters, end: e.currentTarget.value });
            }}
          />
        </label>
        <label>
          Агент
          <select
            value={filters.agent}
            onChange={e => setFilters({ ...filters, agent: e.target.value })}
          >
            <option value="">Усі 10 агентів</option>
            {data.agents.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Маршрут
          <select
            value={filters.route}
            onChange={e => setFilters({ ...filters, route: e.target.value })}
          >
            <option value="">Усі маршрути</option>
            {routeOptions.map(r => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <small>
          {range.start} — {range.end}
        </small>
      </section>
      {tab === 'Огляд' && <MotivationOverview data={data} filters={filters} />}
      {tab === 'Порівняння' && (
        <MotivationComparison data={data} filters={filters} />
      )}
      {(tab === 'Журнал перевірок' || tab === 'Невирішені питання') && (
        <MotivationRecords
          key={JSON.stringify(filters) + tab}
          data={data}
          filters={filters}
          issuesOnly={tab === 'Невирішені питання'}
          onEdit={record => setEditor({ record, revision })}
        />
      )}
      {tab === 'Модель мотивації' && (
        <MotivationSettings
          key={revision}
          data={data}
          busy={mutation.isPending}
          onSave={next => save(next, 'Зміна моделі та складу команди')}
        />
      )}
      {tab === 'Журнал перевірок' && (
        <section className={styles.panel}>
          <h2>Історія змін · усі періоди</h2>
          <p>Дата, користувач та повний знімок кожного успішного збереження.</p>
          {history.isError && (
            <p role="alert" className={styles.errorText}>
              {history.error.message}
            </p>
          )}
          {audit.map(h => (
            <div className={styles.audit} key={h.id}>
              <div>
                <strong>{h.action}</strong>
                <small>
                  {h.actor} ·{' '}
                  {new Date(h.at).toLocaleString('uk-UA', {
                    timeZone: 'Europe/Kyiv',
                  })}{' '}
                  · версія {h.revision}
                </small>
              </div>
              <button
                onClick={async () => {
                  try {
                    const snapshot = await fetchMotivationSnapshot(h.id);
                    downloadFile(
                      `laska-motivation-v${h.revision}.json`,
                      JSON.stringify(snapshot.data, null, 2)
                    );
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : 'Знімок недоступний'
                    );
                  }
                }}
              >
                Знімок JSON
              </button>
            </div>
          ))}
          {!history.isPending && !audit.length && (
            <p>Збережених змін ще немає.</p>
          )}
          {audit.length >= 100 && !endHistory && (
            <button
              disabled={historyBusy}
              onClick={async () => {
                setHistoryBusy(true);
                try {
                  const older = await fetchMotivationHistory(
                    audit[audit.length - 1].revision
                  );
                  setExtraHistory([...extraHistory, ...older]);
                  if (older.length < 100) setEndHistory(true);
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : 'Історія недоступна'
                  );
                } finally {
                  setHistoryBusy(false);
                }
              }}
            >
              Старіші зміни
            </button>
          )}
        </section>
      )}
      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Обмін результатами</h2>
            <p>
              Імпорт JSON за шаблоном або з попередньої панелі Sites. Кожне
              збереження перевіряється сервером.
            </p>
          </div>
          <div className={styles.actions}>
            <label className={styles.fileButton}>
              Імпорт JSON
              <input
                type="file"
                accept=".json,application/json"
                disabled={mutation.isPending}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) void importFile(file);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              onClick={() =>
                downloadFile(
                  'laska-motivation-' + today() + '.json',
                  JSON.stringify(data, null, 2)
                )
              }
            >
              Експорт JSON
            </button>
            <button
              onClick={() =>
                downloadFile(
                  'laska-motivation-template.json',
                  JSON.stringify(
                    [
                      {
                        ...blankRecord(),
                        id: undefined,
                        route: 'Вкажіть маршрут',
                      },
                    ],
                    null,
                    2
                  )
                )
              }
            >
              Шаблон
            </button>
          </div>
        </div>
        {imported && (
          <div className={styles.importPreview}>
            <p>
              Файл містить {imported.count} записів. Після імпорту панель матиме{' '}
              {imported.data.records.length} записів і склад команди з файлу
              (для масиву записів поточна команда зберігається). Поточні дані
              залишаться в історії попередніх збережень.
            </p>
            <div className={styles.actions}>
              <button
                disabled={mutation.isPending}
                onClick={async () => {
                  try {
                    await save(
                      imported.data,
                      'Імпорт результатів JSON',
                      imported.revision
                    );
                    setImported(null);
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : 'Імпорт відхилено'
                    );
                  }
                }}
              >
                Застосувати імпорт
              </button>
              <button
                disabled={mutation.isPending}
                onClick={() => setImported(null)}
              >
                Скасувати
              </button>
            </div>
          </div>
        )}
      </section>
      <p className={styles.footer}>
        SODA · Ласка · Непідтверджені результати не замінюються нулями. Бонусна
        модель тестова.
      </p>
      {editor && (
        <MotivationEditor
          initial={editor.record}
          data={data}
          busy={mutation.isPending}
          asOf={filters.end}
          onClose={() => setEditor(null)}
          onSave={async record => {
            await save(
              {
                ...data,
                records: [
                  ...data.records.filter(r => r.id !== record.id),
                  record,
                ],
              },
              `${data.records.some(r => r.id === record.id) ? 'Оновлення' : 'Нова перевірка'}: ${record.direction}`,
              editor.revision
            );
            setEditor(null);
          }}
        />
      )}
      <dialog
        ref={reportDialog}
        className={styles.dialog}
        aria-labelledby="motivation-report-title"
      >
        <div className={styles.sectionHeader}>
          <h2 id="motivation-report-title">Короткий звіт</h2>
          <button
            aria-label="Закрити звіт"
            onClick={() => reportDialog.current?.close()}
          >
            ✕
          </button>
        </div>
        <pre>{report}</pre>
        <button
          className={styles.primary}
          onClick={() =>
            downloadFile(
              'laska-report-' + today() + '.txt',
              report,
              'text/plain;charset=utf-8'
            )
          }
        >
          Завантажити TXT
        </button>
      </dialog>
    </main>
  );
}
