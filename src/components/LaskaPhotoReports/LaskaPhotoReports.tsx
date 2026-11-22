import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Dexie, { type Table } from 'dexie';
import imageCompression from 'browser-image-compression';
import { apiGet, apiPostFormData } from '../../api/client';
import styles from './LaskaPhotoReports.module.css';

const endpoint = '/api/laska/photo-reports';
const categories = {
  merchandising: 'Мерчендайзинг',
  equipment: 'Обладнання',
  other: 'Інше',
};
type Category = keyof typeof categories;
type Assignment = { department: string; agent_name: string };
type Store = Assignment & { id: string; store_code: string; store_name: string };
type Report = Store & { report_date: string; category: Category; comment: string; photos: { url: string; latitude: number | null; longitude: number | null }[] };
type Draft = {
  owner: string;
  id: string;
  store: Store | null;
  date: string;
  category: Category;
  comment: string;
  photos: { id: string; file: File; latitude: number | null; longitude: number | null }[];
};

const database = new Dexie('SodaLaskaPhotoReports');
database.version(1).stores({ drafts: 'owner' });
const drafts: Table<Draft, string> = database.table('drafts');
const emptyFilters = { from: '', to: '', department: '', agent: '', search: '', category: '' };
const reportDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv' });
const errorMessage = (error: unknown) => error instanceof Error && error.name !== 'TypeError'
  ? error.message : 'Немає зв’язку із сервером. Спробуйте ще раз.';

function FilePreview({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (image.current) image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <img ref={image} alt={file.name} />;
}

function ReportForm({ draft, onSaved }: { draft: Draft; onSaved: () => void }) {
  const [value, setValue] = useState(draft);
  const [storeSearch, setStoreSearch] = useState('');
  const [storeDepartment, setStoreDepartment] = useState('');
  const [storeAgent, setStoreAgent] = useState('');
  const availableAssignments = useQuery({
    queryKey: [endpoint, draft.owner, 'filters'],
    queryFn: ({ signal }) => apiGet<{ rows: Assignment[] }>(endpoint + '/filters', { authenticated: true, signal }),
    retry: false,
  });
  const departments = [...new Set((availableAssignments.data?.rows ?? []).map(row => row.department))].filter(Boolean);
  const agents = [...new Set((availableAssignments.data?.rows ?? []).filter(row => !storeDepartment || row.department === storeDepartment).map(row => row.agent_name))].filter(Boolean);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [locationError, setLocationError] = useState('');
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const [draftStatus, setDraftStatus] = useState<'saving' | 'saved' | 'error'>('saved');
  const pendingSave = useRef<Promise<void>>(Promise.resolve());
  const autosaveTimer = useRef<number | null>(null);
  const submitted = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Serialize IndexedDB writes so an older draft cannot overwrite a newer one.
  function persistDraft(snapshot: Draft): Promise<void> {
    const write = pendingSave.current.catch(() => undefined).then(async () => {
      await drafts.put(snapshot);
    });
    pendingSave.current = write;
    return write;
  }

  useEffect(() => {
    setDraftStatus('saving');
    autosaveTimer.current = window.setTimeout(() => {
      autosaveTimer.current = null;
      void persistDraft(value).then(() => setDraftStatus('saved'), () => setDraftStatus('error'));
    }, 400);
    return () => {
      if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current);
      // Save even on navigation/unmount; do not depend on a browser unload event.
      if (!submitted.current) void persistDraft(value).catch(() => undefined);
    };
  }, [value]);

  async function flushDraft(): Promise<void> {
    if (autosaveTimer.current !== null) {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    await persistDraft(valueRef.current);
    setDraftStatus('saved');
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(storeSearch.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [storeSearch]);

  const stores = useQuery({
    queryKey: [endpoint, draft.owner, 'stores', search, storeDepartment, storeAgent],
    queryFn: ({ signal }) => apiGet<{ rows: Store[] }>(endpoint + '/stores', {
      authenticated: true, query: { search, department: storeDepartment, agent: storeAgent }, signal,
    }),
    enabled: !value.store && search.length >= 2,
    retry: false,
  });

  async function addPhotos(files: File[]) {
    if (!files.length) return;
    if (value.photos.length + files.length > 5) {
      setFeedback('Можна додати до п’яти фото.');
      return;
    }
    setBusy(true);
    setFeedback('');
    setLocationError('');
    try {
      const nextPhotos: Draft['photos'] = [];
      if (!navigator.geolocation) throw new Error('Геолокація недоступна на цьому пристрої. Фотозвіт потребує GPS.');
      const location = await new Promise<{latitude:number;longitude:number}>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(position => resolve({latitude:position.coords.latitude,longitude:position.coords.longitude}), () => reject(new Error('Увімкніть геолокацію та дозвольте доступ до місцезнаходження для фотозвіту.')), {enableHighAccuracy:true,timeout:15000,maximumAge:0});
      });
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          throw new Error('Виберіть фото JPG, PNG або WebP.');
        }
        const compressed = await imageCompression(file, {
          maxSizeMB: 1.5, maxWidthOrHeight: 2400, useWebWorker: true, fileType: 'image/jpeg',
        });
        if (compressed.size > 5 * 1024 * 1024) throw new Error('Фото перевищує 5 МБ.');
        nextPhotos.push({ id: crypto.randomUUID(), file: compressed, latitude: location.latitude, longitude: location.longitude });
      }
      setValue(current => ({ ...current, photos: [...current.photos, ...nextPhotos] }));
    } catch (error) {
      setLocationError(errorMessage(error));
      setFeedback(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function save(send: boolean) {
    setBusy(true);
    setFeedback('');
    try {
      try {
        await flushDraft();
      } catch {
        setDraftStatus('error');
        throw new Error('Не вдалося зберегти чернетку на пристрої. Перевірте вільне місце та дозволи браузера.');
      }
      if (!send) {
        setFeedback('Чернетку збережено на цьому пристрої.');
        return;
      }
      if (!navigator.onLine) {
        setFeedback('Чернетку збережено. Надішліть її, коли повернеться інтернет.');
        return;
      }
      if (value.photos.some(photo => photo.latitude == null || photo.longitude == null)) {
        setFeedback('Геолокація обов’язкова для кожного фото. Приберіть фото без координат та зробіть його повторно.');
        return;
      }
      if (!value.store || !value.photos.length) {
        setFeedback('Виберіть торгову точку й додайте хоча б одне фото.');
        return;
      }
      const data = new FormData();
      data.set('id', value.id);
      data.set('routeId', value.store.id);
      data.set('reportDate', value.date);
      data.set('category', value.category);
      data.set('comment', value.comment);
      data.set('photoLocations', JSON.stringify(value.photos.map(photo => ({ latitude: photo.latitude ?? null, longitude: photo.longitude ?? null }))));
      for (const { file } of value.photos) data.append('photos', file, 'photo.jpg');
      await apiPostFormData(endpoint, data, { authenticated: true, tenant: 'laska' });
      submitted.current = true;
      await pendingSave.current.catch(() => undefined);
      await drafts.delete(value.owner).catch(() => undefined);
      onSaved();
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return <form className={styles.panel} onSubmit={event => { event.preventDefault(); void save(true); }}>
    <fieldset disabled={busy}>
      <legend>Новий фотозвіт</legend>
      {value.store ? <div className={styles.toolbar}>
        <strong>{value.store.store_name} · {value.store.agent_name}</strong>
        <button type="button" onClick={() => setValue(current => ({ ...current, store: null }))}>Змінити точку</button>
      </div> : <>
        <div className={styles.filters}>
          <label>Відділ<select value={storeDepartment} onChange={event => { setStoreDepartment(event.target.value); setStoreAgent(''); }}>
            <option value="">Усі доступні</option>
            {departments.map(item => <option key={item} value={item}>{item}</option>)}
          </select></label>
          <label>Торговий представник<select value={storeAgent} onChange={event => setStoreAgent(event.target.value)}>
            <option value="">Усі доступні</option>
            {agents.map(item => <option key={item} value={item}>{item}</option>)}
          </select></label>
        </div>
        <label>Торгова точка<input type="search" maxLength={200} value={storeSearch}
          placeholder="Введіть щонайменше 2 символи назви торгової точки"
          onChange={event => setStoreSearch(event.target.value)} /></label>
        {search.length >= 2 && storeSearch.trim() === search && <>
          {stores.isFetching && <p role="status">Шукаємо торгові точки…</p>}
          {stores.isPaused && <p role="status">Для пошуку торгових точок потрібен інтернет.</p>}
          {stores.isError && <p role="alert">{errorMessage(stores.error)}</p>}
          {stores.isSuccess && !stores.data.rows.length && <p>Торгових точок не знайдено.</p>}
          <div className={styles.storeResults}>{stores.data?.rows.map(store =>
            <button type="button" key={store.id} onClick={() => setValue(current => ({ ...current, store }))}>
              <strong>{store.store_name}</strong><small>{store.store_code} · {store.agent_name}</small>
            </button>)}</div>
        </>}
      </>}
      <div className={styles.filters}>
        <label>Дата звіту<input required type="date" value={value.date}
          onChange={event => setValue(current => ({ ...current, date: event.target.value }))} /></label>
        <label>Категорія<select value={value.category}
          onChange={event => setValue(current => ({ ...current, category: event.target.value as Category }))}>
          {Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>
      <label>Коментар<textarea rows={3} maxLength={1000} value={value.comment}
        onChange={event => setValue(current => ({ ...current, comment: event.target.value }))} /></label>
      <div className={styles.toolbar}>
        <button type="button" onClick={() => camera.current?.click()} disabled={value.photos.length >= 5}>Зробити фото</button>
        <button type="button" onClick={() => gallery.current?.click()} disabled={value.photos.length >= 5}>Вибрати з галереї</button>
        <span>Фото {value.photos.length} із 5 · GPS обов’язковий</span>
        {[camera, gallery].map((ref, index) => <input key={index} hidden ref={ref} type="file"
          accept="image/jpeg,image/png,image/webp" capture={index === 0 ? 'environment' : undefined}
          multiple={index === 1} onChange={event => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = '';
            void addPhotos(files);
          }} />)}
      </div>
      {locationError && <p role="alert">{locationError}</p>}
      {value.photos.length > 0 && <div className={styles.photos}>{value.photos.map(({ id, file, latitude, longitude }, index) =>
        <div key={id}><FilePreview file={file} /><small>{latitude != null && longitude != null ? `📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : '⚠️ Немає GPS'}</small>
          <button type="button" aria-label={`Прибрати фото ${index + 1}`} onClick={() =>
            setValue(current => ({ ...current, photos: current.photos.filter(photo => photo.id !== id) }))}>Прибрати</button>
        </div>)}</div>}
      <div className={styles.toolbar}>
        <button className={styles.primary} type="submit">Надіслати фотозвіт</button>
        <button type="button" onClick={() => void save(false)}>Зберегти чернетку</button>
      </div>
    </fieldset>
    <p role="status">{draftStatus === 'saving' ? 'Автозбереження чернетки…' : draftStatus === 'error' ? 'Не вдалося автоматично зберегти чернетку.' : 'Чернетка збережена на пристрої.'}</p>
    {busy && <p role="status">Обробляємо…</p>}
    {feedback && <p role="status">{feedback}</p>}
  </form>;
}

function DraftForm({ email, onSaved }: { email: string; onSaved: () => void }) {
  const draft = useQuery({
    queryKey: ['laska-photo-draft', email],
    queryFn: async (): Promise<Draft> => (await drafts.get(email).catch(() => undefined)) ?? {
      owner: email, id: crypto.randomUUID(), store: null, date: reportDate.format(new Date()),
      category: 'merchandising', comment: '', photos: [],
    },
    networkMode: 'always',
    gcTime: 0,
  });
  return draft.data ? <ReportForm draft={draft.data} onSaved={onSaved} />
    : <p role="status">{draft.isError ? 'Не вдалося відкрити чернетку.' : 'Відкриваємо чернетку…'}</p>;
}

export default function LaskaPhotoReports({ email, mode = 'gallery' }: { email: string; mode?: 'gallery' | 'create' }) {
  const [creating, setCreating] = useState(mode === 'create');
  const [saved, setSaved] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const client = useQueryClient();
  const queryKey = [endpoint, email];

  const reportList = useQuery({
    queryKey: [...queryKey, applied, page],
    queryFn: ({ signal }) => apiGet<{ rows: Report[]; hasNext: boolean }>(endpoint, {
      authenticated: true, query: { ...applied, page }, signal,
    }),
    retry: false,
    enabled: mode === 'gallery',
    staleTime: 60_000,
  });
  const options = useQuery({
    queryKey: [...queryKey, 'filters'],
    queryFn: ({ signal }) => apiGet<{ rows: Assignment[] }>(endpoint + '/filters', { authenticated: true, signal }),
    retry: false,
    enabled: mode === 'gallery',
    staleTime: 5 * 60_000,
  });
  const assignments = options.data?.rows ?? [];
  const departments = [...new Set(assignments.map(row => row.department))].filter(Boolean);
  const agents = [...new Set(assignments.filter(row => !filters.department || row.department === filters.department)
    .map(row => row.agent_name))].sort((a, b) => a.localeCompare(b, 'uk'));
  const invalidDates = Boolean(filters.from && filters.to && filters.from > filters.to);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalidDates) return;
    setApplied(filters);
    setPage(1);
    if (applied === filters && page === 1) void reportList.refetch();
  }

  return <section className={styles.page} aria-label="Фотозвіт">
    <div className={styles.toolbar}>
      <h1>{mode === 'gallery' ? 'Галерея' : 'Фотозвіт'}</h1>
      {mode === 'create' && <button type="button" className={styles.primary} aria-expanded={creating}
        onClick={() => { setCreating(!creating); setSaved(false); }}>
        {creating ? 'Закрити форму' : 'Додати фотозвіт'}
      </button>}
    </div>
    {saved && <p role="status">Фотозвіт збережено.</p>}
    {creating && <DraftForm email={email} onSaved={() => {
      setCreating(false);
      setSaved(true);
      setPage(1);
      void client.invalidateQueries({ queryKey });
    }} />}
    {mode === 'gallery' && <form className={styles.panel} onSubmit={applyFilters}>
      <div className={styles.filters}>
        <label>Дата від<input type="date" value={filters.from} onChange={event => setFilters({ ...filters, from: event.target.value })} /></label>
        <label>Дата до<input type="date" value={filters.to} onChange={event => setFilters({ ...filters, to: event.target.value })} /></label>
        <label>Відділ<select value={filters.department} onChange={event => setFilters({ ...filters, department: event.target.value, agent: '' })}>
          <option value="">Усі доступні</option>
          {departments.map(item => <option key={item}>{item}</option>)}
        </select></label>
        <label>Торговий агент<select value={filters.agent} onChange={event => setFilters({ ...filters, agent: event.target.value })}>
          <option value="">Усі доступні</option>
          {agents.map(item => <option key={item}>{item}</option>)}
        </select></label>
        <label>Торгова точка<input type="search" maxLength={200} placeholder="Назва або код"
          value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} /></label>
        <label>Категорія<select value={filters.category} onChange={event => setFilters({ ...filters, category: event.target.value })}>
          <option value="">Усі категорії</option>
          {Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>
      {options.isError && <p role="alert">Не вдалося завантажити відділи й агентів. <button type="button" onClick={() => void options.refetch()}>Повторити</button></p>}
      {invalidDates && <p role="alert">Кінцева дата має бути не раніше початкової.</p>}
      <div className={styles.toolbar}>
        <button className={styles.primary} type="submit" disabled={invalidDates}>Застосувати</button>
        <button type="button" onClick={() => { setFilters(emptyFilters); setApplied(emptyFilters); setPage(1); }}>Скинути</button>
      </div>
    </form>}
    {mode === 'gallery' && reportList.isError && <p role="alert">{errorMessage(reportList.error)} <button type="button" onClick={() => void reportList.refetch()}>Повторити</button></p>}
    {mode === 'gallery' && reportList.isPending && <p role="status">{reportList.isPaused ? 'Для перегляду звітів потрібен інтернет.' : 'Завантажуємо фотозвіти…'}</p>}
    {mode === 'gallery' && reportList.isSuccess && !reportList.data.rows.length && <p>Фотозвітів за цими фільтрами немає.</p>}
    {mode === 'gallery' && <div className={styles.galleryStats}>
      <div className={styles.statCard}><span>Кількість ТТ</span><strong>{new Set(reportList.data?.rows.map(row => row.store_code) ?? []).size}</strong></div>
      <div className={styles.statCard}><span>Кількість фото</span><strong>{reportList.data?.rows.reduce((total, row) => total + row.photos.length, 0) ?? 0}</strong></div>
    </div>}
    {mode === 'gallery' && <div className={styles.galleryGrid}>{reportList.data?.rows.flatMap(report =>
      report.photos.map((photo, index) => <article key={`${report.id}-${index}`} className={styles.galleryCard}>
        <button type="button" className={styles.galleryImageButton} onClick={() => setActivePhoto(photo.url)} aria-label={`Переглянути фото ${index + 1}: ${report.store_name}`}>
          <img src={photo.url} loading="lazy" referrerPolicy="no-referrer" alt={`Фото ${index + 1}: ${report.store_name}`} />
        </button>
        <div className={styles.galleryInfo}>
          <strong>ТТ: {report.store_name}</strong>
          <span>Категорія: {categories[report.category]}</span>
          <span>{report.report_date.split('-').reverse().join('.')} · {report.agent_name}</span>
          {report.comment && <span className={styles.comment}>{report.comment}</span>}
          {photo.latitude != null && photo.longitude != null
            ? <a href={`https://www.google.com/maps?q=${photo.latitude},${photo.longitude}`} target="_blank" rel="noreferrer" className={styles.location}>📍 {photo.latitude.toFixed(5)}, {photo.longitude.toFixed(5)} · Карта</a>
            : <span className={styles.location}>Геолокація відсутня (старий звіт)</span>}
        </div>
      </article>)
    )}</div>}
    {mode === 'gallery' && activePhoto && <div className={styles.viewer} role="dialog" aria-modal="true" aria-label="Перегляд фото" onClick={() => setActivePhoto(null)}>
      <button type="button" className={styles.viewerClose} onClick={() => setActivePhoto(null)}>✕ Закрити</button>
      <img src={activePhoto} alt="Фото у повному розмірі" onClick={event => event.stopPropagation()} />
    </div>}
    {mode === 'gallery' && (page > 1 || reportList.data?.hasNext) && <nav className={styles.toolbar} aria-label="Сторінки фотозвітів">
      <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Попередня</button>
      <span>Сторінка {page}</span>
      <button type="button" disabled={!reportList.data?.hasNext} onClick={() => setPage(page + 1)}>Наступна</button>
    </nav>}
  </section>;
}
