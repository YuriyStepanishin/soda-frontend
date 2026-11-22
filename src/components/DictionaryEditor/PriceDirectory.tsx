import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { reportDeliveryMessage, savePreparedReport, sharePreparedReport } from '../../utils/reportDelivery';
import type { PreparedReportFile } from '../../utils/reportDelivery';
import {
  activePriceRows, calculatedPrice, preparePriceFile, sectionKey, sectionOrder,
  sortPriceRows, withPriceHeadings,
} from './priceDirectoryData';
import type { PriceMode, PriceRow } from './priceDirectoryData';
import styles from './PriceDirectory.module.css';

export type PriceSnapshot = { date: string; canViewPurchase: boolean; rows: PriceRow[] };
type Sections = Map<string, Section>;
type Section = { children: Sections; keys: Set<string> };

const pageSize = 20;
const money = new Intl.NumberFormat('uk-UA', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const normalize = (text: string) =>
  text.toLocaleLowerCase('uk-UA').trim().replace(/\s+/g, ' ');

function buildSections(rows: PriceRow[]) {
  const root: Sections = new Map();
  for (const row of rows) {
    const key = sectionKey(row.route);
    let level = root;
    for (const name of row.route) {
      let section = level.get(name);
      if (!section) {
        section = { children: new Map(), keys: new Set() };
        level.set(name, section);
      }
      section.keys.add(key);
      level = section.children;
    }
  }
  return root;
}

function SectionCheckbox({ name, keys, selected, onSelect }: {
  name: string;
  keys: Set<string>;
  selected: Set<string> | null;
  onSelect: (keys: Set<string>, checked: boolean) => void;
}) {
  const count = selected ? Array.from(keys).filter(key => selected.has(key)).length : keys.size;
  return <label className={styles.sectionChoice}>
    <input
      type="checkbox"
      checked={count === keys.size && count > 0}
      ref={input => { if (input) input.indeterminate = count > 0 && count < keys.size; }}
      onChange={event => onSelect(keys, event.currentTarget.checked)}
    />
    {name}
  </label>;
}

function SectionChoices({ sections, selected, onSelect }: {
  sections: Sections;
  selected: Set<string> | null;
  onSelect: (keys: Set<string>, checked: boolean) => void;
}) {
  return (
    <ul>
      {[...sections]
        .sort(([a], [b]) => sectionOrder.compare(a, b))
        .map(([name, section]) => (
            <li key={name}>
              {section.children.size ? (
                <details>
                  <summary><SectionCheckbox name={name} keys={section.keys} selected={selected} onSelect={onSelect} /></summary>
                  <SectionChoices
                    sections={section.children}
                    selected={selected}
                    onSelect={onSelect}
                  />
                </details>
              ) : (
                <SectionCheckbox name={name} keys={section.keys} selected={selected} onSelect={onSelect} />
              )}
            </li>
        ))}
    </ul>
  );
}

const formatPrice = (value: number | null) =>
  value === null ? '—' : money.format(value);

export default function PriceDirectory({
  loadPrice,
}: {
  loadPrice: (signal: AbortSignal) => Promise<PriceSnapshot>;
}) {
  const [snapshot, setSnapshot] = useState<PriceSnapshot | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [mode, setMode] = useState<PriceMode>('discount');
  const [percent, setPercent] = useState('0');
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [exportError, setExportError] = useState('');
  const prepared = useRef<{ rows: PriceRow[]; date: string; mode: PriceMode; rate: number; file: PreparedReportFile } | null>(null);
  const picker = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void loadPrice(controller.signal)
      .then(data => {
        if (!controller.signal.aborted) setSnapshot(data);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Не вдалося завантажити прайс.'
          );
      });
    return () => controller.abort();
  }, [loadPrice, attempt]);

  const rows = useMemo(() => sortPriceRows(activePriceRows(snapshot?.rows ?? [])), [snapshot]);
  const sections = useMemo(() => buildSections(rows), [rows]);
  const sectionKeys = useMemo(() => new Set(rows.map(row => sectionKey(row.route))), [rows]);
  const filtered = useMemo(() => {
    const term = normalize(query);
    return rows.filter(
      row =>
        (!selected || selected.has(sectionKey(row.route))) && normalize(row.name).includes(term)
    );
  }, [rows, query, selected]);
  const visibleRows = withPriceHeadings(filtered.slice(0, visibleCount));
  const canViewPurchase = snapshot?.canViewPurchase === true;
  const calculationMode = canViewPurchase ? mode : 'discount';
  const normalizedPercent = percent.trim().replace(',', '.');
  const numericPercent = Number(normalizedPercent);
  const rate =
    /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalizedPercent) &&
    Number.isFinite(numericPercent) &&
    (calculationMode === 'markup' || numericPercent <= 100)
      ? numericPercent
      : null;

  function closePicker() {
    if (!picker.current) return;
    picker.current.open = false;
    picker.current.querySelector('summary')?.focus();
  }

  function selectSection(keys: Set<string>, checked: boolean) {
    setSelected(current => {
      const next = new Set(current ?? sectionKeys);
      for (const key of keys) {
        if (checked) next.add(key);
        else next.delete(key);
      }
      return next.size === sectionKeys.size ? null : next;
    });
    setVisibleCount(pageSize);
  }

  async function deliverPrice(share: boolean) {
    if (!snapshot || rate === null || !filtered.length) return;
    setExporting(true);
    setExportMessage('');
    setExportError('');
    try {
      const { date } = snapshot;
      const cached = prepared.current;
      const file = cached?.rows === filtered && cached.date === date && cached.mode === calculationMode && cached.rate === rate
        ? cached.file
        : await preparePriceFile(filtered, date, calculationMode, rate);
      prepared.current = { rows: filtered, date, mode: calculationMode, rate, file };
      const result = share ? await sharePreparedReport(file) : 'saved';
      savePreparedReport(file);
      setExportMessage(reportDeliveryMessage(result));
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Не вдалося сформувати прайс.');
    } finally {
      setExporting(false);
    }
  }

  if (error)
    return (
      <>
        <p role="alert">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError('');
            setAttempt(value => value + 1);
          }}
        >
          Повторити
        </button>
      </>
    );
  if (!snapshot) return <p role="status">Завантаження прайсу…</p>;

  return (
    <section className={styles.price} aria-label="Прайс ЛАСКА">
      <h2>Прайс</h2>
      <p className={styles.muted}>Від {snapshot.date} · грн з ПДВ за одиницю</p>
      <div className={styles.controls}>
        <label>
          Пошук за назвою
          <input
            type="search"
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setVisibleCount(pageSize);
            }}
          />
        </label>
        {canViewPurchase && <label>
          Розрахунок ціни
          <select
            value={mode}
            onChange={event => setMode(event.target.value as PriceMode)}
          >
            <option value="markup">Націнка</option>
            <option value="discount">Знижка</option>
          </select>
        </label>}
        <label>
          {canViewPurchase ? 'Відсоток' : 'Знижка, %'}
          <input
            className={styles.percent}
            inputMode="decimal"
            value={percent}
            aria-invalid={rate === null}
            onChange={event => setPercent(event.target.value)}
          />
        </label>
        <div className={styles.filter}>
          <span>Розділ прайсу</span>
          <details
            ref={picker}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault();
                closePicker();
              }
            }}
          >
            <summary>
              {selected ? `Позначені підрозділи: ${selected.size}` : 'Усі розділи'}
            </summary>
            <div className={styles.tree}>
              <SectionCheckbox name="Усі розділи" keys={sectionKeys} selected={selected} onSelect={selectSection} />
              {selected?.size !== 0 && <button type="button" onClick={() => selectSection(sectionKeys, false)}>Зняти всі позначки</button>}
              <SectionChoices
                sections={sections}
                selected={selected}
                onSelect={selectSection}
              />
            </div>
          </details>
        </div>
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setSelected(null);
            setVisibleCount(pageSize);
          }}
        >
          Скинути фільтри
        </button>
      </div>
      <div className={styles.delivery}>
        <button type="button" disabled={exporting || rate === null || !filtered.length} onClick={() => void deliverPrice(false)}>Зберегти Excel</button>
        <button type="button" disabled={exporting || rate === null || !filtered.length} onClick={() => void deliverPrice(true)}>Зберегти та відправити</button>
        {exporting && <span role="status">Формую прайс…</span>}
      </div>
      {exportMessage && <p role="status">{exportMessage}</p>}
      {exportError && <p role="alert">{exportError}</p>}
      <p role="status" className={styles.muted}>
        Позицій: {filtered.length.toLocaleString('uk-UA')}
        {rate === null && ' · Введіть допустимий відсоток.'}
      </p>
      <div className={styles.scroll} tabIndex={0} aria-label="Таблиця прайсу">
        <table>
          <thead>
            <tr>
              {[
                'Назва',
                'Одиниця',
                ...(canViewPurchase ? ['Закупка'] : []),
                'Доставка +3',
                'Розрахункова ціна',
              ].map(label => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ headings, row }) => <Fragment key={row.row}>
              {headings.map(heading => <tr key={heading.key} className={styles.sectionHeading}>
                <th colSpan={canViewPurchase ? 5 : 4} style={{ paddingInlineStart: 12 + heading.depth * 16 }}>{heading.name}</th>
              </tr>)}
              <tr key={row.row}>
                <td>{row.name}</td>
                <td>{row.unit}</td>
                {canViewPurchase && <td>{formatPrice(row.purchase ?? null)}</td>}
                <td>{formatPrice(row.base)}</td>
                <td>{formatPrice(calculatedPrice(row, calculationMode, rate))}</td>
              </tr>
            </Fragment>)}
            {!filtered.length && <tr><td colSpan={canViewPurchase ? 5 : 4}>Позицій не знайдено.</td></tr>}
          </tbody>
        </table>
      </div>
      {visibleCount < filtered.length && (
        <div className={styles.pager}>
          <button
            type="button"
            onClick={() => setVisibleCount(value => value + pageSize)}
          >
            Показати ще
          </button>
        </div>
      )}
    </section>
  );
}
