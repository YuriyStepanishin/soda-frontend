import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchStoreCheckReports,
  type StoreCheckMetric,
  type StoreCheckReport,
} from '../../api/fetchStoreCheckReports';
import { queryKeys } from '../../api/queryKeys';
import Loader from '../Loader/Loader';
import SearchInput from '../SearchInput';
import styles from './StoreCheckReviewPage.module.css';

type Props = {
  onBack: () => void;
};

function parseDateValue(raw: string): number {
  const text = String(raw || '').trim();
  if (!text) return 0;

  const dmy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
    const parsed = new Date(year, month - 1, day).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  const parsed = new Date(text).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toNumber(value: string): number {
  const normalized = String(value || '')
    .replace(',', '.')
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isZeroMetric(metric: StoreCheckMetric): boolean {
  if (!metric.value) return false;
  const num = toNumber(metric.value);
  return num === 0;
}

const TM_SUM_LABELS: Record<string, string> = {
  tea: 'Чай',
  coffee: 'Кава',
  strauss: 'Strauss',
  water: 'Вода',
  delicia: 'Delicia',
  other: 'Інше',
  bg: 'BG',
  snacks: 'Снеки',
};

const METRIC_GROUPS: Array<{ title: string; labels: string[] }> = [
  {
    title: 'Категорії',
    labels: ['Категорія Orimi', 'Категорія Delicia'],
  },
  {
    title: 'Чай',
    labels: ['Принцеса', 'Greenfield', 'TESS', 'Чай разом'],
  },
  {
    title: 'Кава',
    labels: ['Жокей', 'Jardin', 'Piazza', 'Кава разом'],
  },
  {
    title: 'Strauss',
    labels: [
      'Elite Fort',
      'Чорна Карта',
      'Ambassador',
      'Цикорій+напої',
      'Strauss разом',
    ],
  },
  {
    title: 'Вода',
    labels: ['Bon Boisson', 'Чудо Сад', 'Вода разом'],
  },
  {
    title: 'Delicia / Інше',
    labels: [
      'Flex Delicia',
      'Flex Інше',
      'Тубус Delicia',
      'Тубус Інше',
      '0.25-0.45 Delicia',
      '0.25-0.45 Інше',
      'Вагове Delicia',
      'Вагове Інше',
      'Delicia разом',
      'Інше разом',
    ],
  },
  {
    title: 'Вагове печиво',
    labels: ['Домашнє', 'Мальвіна', 'До чаю', 'Джулія какао'],
  },
  {
    title: 'З наповнювачем і глазуроване',
    labels: [
      'Супер Моніка',
      'Желейна ягідка',
      'Артемон',
      'Маргаритка',
      'Інь-Янь',
    ],
  },
  {
    title: 'Прянична група',
    labels: ['Ворзельський', 'Баварський', 'Ведмедики', 'Мамин пряник'],
  },
  {
    title: 'Вафельна група',
    labels: ['Трубочка', 'Ритм/Артек'],
  },
  {
    title: 'Додатковий асортимент',
    labels: [
      'Вівсяне/Кукурудзяне',
      'Альпійське/Фітнес',
      'Супер Стар BG',
      'Інше печиво',
      'Інше пряник',
      'BG',
      'Інші снеки',
    ],
  },
];

function groupMetrics(metrics: StoreCheckMetric[]) {
  const byLabel = new Map(metrics.map(metric => [metric.label, metric]));
  const used = new Set<string>();

  const grouped = METRIC_GROUPS.map(group => {
    const items = group.labels
      .map(label => byLabel.get(label))
      .filter((metric): metric is StoreCheckMetric => Boolean(metric));

    items.forEach(metric => used.add(metric.label));

    return {
      title: group.title,
      items,
    };
  }).filter(group => group.items.length > 0);

  const ungrouped = metrics.filter(metric => !used.has(metric.label));
  if (ungrouped.length > 0) {
    grouped.push({
      title: 'Інше',
      items: ungrouped,
    });
  }

  return grouped;
}

type StoreGroup = {
  key: string;
  latest: StoreCheckReport;
  latestDateValue: number;
  photos: string[];
};

export default function StoreCheckReviewPage({ onBack }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [repFilter, setRepFilter] = useState('all');

  const {
    data: reports = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.storecheckReports,
    queryFn: fetchStoreCheckReports,
    staleTime: 1000 * 60 * 3,
  });

  const representatives = useMemo(() => {
    return [
      'all',
      ...Array.from(
        new Set(
          reports
            .filter(
              item =>
                departmentFilter === 'all' ||
                item.department === departmentFilter
            )
            .map(item => item.representative)
            .filter(Boolean)
        )
      ),
    ];
  }, [reports, departmentFilter]);

  const departments = useMemo(() => {
    return [
      'all',
      ...Array.from(
        new Set(reports.map(item => item.department).filter(Boolean))
      ),
    ];
  }, [reports]);

  const grouped = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const groups = new Map<string, StoreGroup>();

    reports
      .filter(item => {
        const depOk =
          departmentFilter === 'all' || item.department === departmentFilter;
        const repOk = repFilter === 'all' || item.representative === repFilter;
        const searchOk =
          !query ||
          item.store.toLowerCase().includes(query) ||
          item.department.toLowerCase().includes(query) ||
          item.representative.toLowerCase().includes(query);

        return depOk && repOk && searchOk;
      })
      .forEach(item => {
        const key = item.store.trim().toLowerCase();
        if (!key) return;

        const existing = groups.get(key);
        const itemDate = parseDateValue(item.date);
        const photoSet = new Set(
          (existing?.photos || []).concat(
            item.photos.map(photo => String(photo || '').trim()).filter(Boolean)
          )
        );

        if (!existing) {
          groups.set(key, {
            key,
            latest: item,
            latestDateValue: itemDate,
            photos: Array.from(photoSet),
          });
          return;
        }

        const isNewer = itemDate > existing.latestDateValue;
        groups.set(key, {
          key,
          latest: isNewer ? item : existing.latest,
          latestDateValue: isNewer ? itemDate : existing.latestDateValue,
          photos: Array.from(photoSet),
        });
      });

    return Array.from(groups.values()).sort(
      (a, b) => b.latestDateValue - a.latestDateValue
    );
  }, [reports, departmentFilter, repFilter, searchTerm]);

  const filteredStoreCount = grouped.length;

  const filteredPhotoCount = useMemo(
    () => grouped.reduce((sum, item) => sum + item.photos.length, 0),
    [grouped]
  );

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.statsCompact}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Кількість ТТ</span>
            <strong className={styles.statValue}>{filteredStoreCount}</strong>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Кількість фото</span>
            <strong className={styles.statValue}>{filteredPhotoCount}</strong>
          </div>
        </div>

        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Пошук ТТ"
          ariaLabel="Пошук StoreCheck"
          className={styles.searchInput}
        />

        <select
          className={styles.select}
          value={departmentFilter}
          onChange={e => {
            setDepartmentFilter(e.target.value);
            setRepFilter('all');
          }}
        >
          {departments.map(dep => (
            <option key={dep} value={dep}>
              {dep === 'all' ? 'Усі відділи' : dep}
            </option>
          ))}
        </select>

        <select
          className={styles.select}
          value={repFilter}
          onChange={e => setRepFilter(e.target.value)}
        >
          {representatives.map(rep => (
            <option key={rep} value={rep}>
              {rep === 'all' ? 'Усі торгові представники' : rep}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <Loader />}

      {!isLoading && error && (
        <p className={styles.empty}>
          {error instanceof Error
            ? error.message
            : 'Не вдалося завантажити StoreCheck.'}
        </p>
      )}

      {!isLoading && !error && grouped.length === 0 && (
        <p className={styles.empty}>Немає фото</p>
      )}

      <div className={styles.list}>
        {grouped.map(item => (
          <StoreCheckCard
            key={item.key}
            item={item.latest}
            photos={item.photos}
          />
        ))}
      </div>

      <button type="button" className={styles.backButton} onClick={onBack}>
        ← Назад
      </button>
    </div>
  );
}

function StoreCheckCard({
  item,
  photos,
}: {
  item: StoreCheckReport;
  photos: string[];
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const groupedMetrics = useMemo(
    () => groupMetrics(item.metrics),
    [item.metrics]
  );

  useEffect(() => {
    setPhotoIndex(0);
  }, [item.store, photos.length]);

  const hasPhotos = photos.length > 0;
  const safeIndex = Math.min(photoIndex, Math.max(photos.length - 1, 0));
  const activePhoto = hasPhotos ? photos[safeIndex] : '';

  function showPrevPhoto() {
    setPhotoIndex(prev => (prev - 1 + photos.length) % photos.length);
  }

  function showNextPhoto() {
    setPhotoIndex(prev => (prev + 1) % photos.length);
  }

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.store}>{item.store}</h2>
          <p className={styles.meta}>
            {item.department} • {item.representative}
          </p>
        </div>
        <strong className={styles.meta}>{item.date}</strong>
      </div>

      <div className={styles.photoViewer}>
        {hasPhotos ? (
          <a
            href={activePhoto}
            target="_blank"
            rel="noreferrer"
            className={styles.photoLink}
          >
            <img src={activePhoto} className={styles.photo} alt="StoreCheck" />
          </a>
        ) : (
          <div className={styles.photoPlaceholder}>
            <span className={styles.photoPlaceholderIcon}>📷</span>
            <span>Немає фото</span>
          </div>
        )}

        {photos.length > 1 && (
          <>
            <button
              type="button"
              className={`${styles.photoNav} ${styles.photoPrev}`}
              onClick={showPrevPhoto}
              aria-label="Попереднє фото"
            >
              ‹
            </button>
            <button
              type="button"
              className={`${styles.photoNav} ${styles.photoNext}`}
              onClick={showNextPhoto}
              aria-label="Наступне фото"
            >
              ›
            </button>
            <span className={styles.photoCounter}>
              {safeIndex + 1}/{photos.length}
            </span>
          </>
        )}
      </div>

      <h3 className={styles.sectionTitle}>Сума продажів по ТМ</h3>
      <div className={styles.tmSums}>
        {Object.entries(item.tmSums).map(([key, value]) => (
          <div key={key} className={styles.sumItem}>
            <span className={styles.sumLabel}>{TM_SUM_LABELS[key] || key}</span>
            <strong className={styles.sumValue}>{value}</strong>
          </div>
        ))}
      </div>

      <h3 className={styles.sectionTitle}>Дані форми</h3>
      <div className={styles.metricGroups}>
        {groupedMetrics.map(group => (
          <section key={group.title} className={styles.metricBlock}>
            <h4 className={styles.metricGroupTitle}>{group.title}</h4>
            <div className={styles.metrics}>
              {group.items.map(metric => {
                const zero = isZeroMetric(metric);
                return (
                  <div key={metric.label} className={styles.metricRow}>
                    <span className={styles.metricLabel}>{metric.label}</span>
                    <span className={styles.metricValueWrap}>
                      <span className={styles.metricValue}>{metric.value}</span>
                      {zero && <span className={styles.zeroDot} />}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {(item.commentOrimi || item.commentDelicia) && (
        <div className={styles.comment}>
          {item.commentOrimi ? `Orimi: ${item.commentOrimi}` : ''}
          {item.commentOrimi && item.commentDelicia ? ' | ' : ''}
          {item.commentDelicia ? `Delicia: ${item.commentDelicia}` : ''}
        </div>
      )}
    </article>
  );
}
