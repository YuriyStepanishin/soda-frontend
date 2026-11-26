import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Dexie, { type Table } from 'dexie';
import imageCompression from 'browser-image-compression';
import { apiGet, getActiveTenant } from '../../api/client';
import { API_BASE_URL } from '../../api/config';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '../../api/config';
import styles from './LaskaPhotoReports.module.css';
import AppDialog from '../Navigation/AppDialog';
import { getUserRole } from '../../config/userRoles';

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
database.version(2).stores({ drafts: 'owner', photoOutbox: 'id,owner' });
const drafts: Table<Draft, string> = database.table('drafts');
const photoOutbox: Table<Draft, string> = database.table('photoOutbox');

// An upload is owned by the app, not the form: navigating away does not abort it.
// IndexedDB retains the photos until the server confirms success.
let outboxRunning = false;
const queueEvent = 'soda:laska-photo-outbox';
const queueProgressEvent = 'soda:laska-photo-progress';
const postQueueProgress = (percent: number) => window.dispatchEvent(new CustomEvent(queueProgressEvent, { detail: percent }));
function uploadPhotoReport(data: FormData): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', new URL(endpoint, API_BASE_URL).toString());
    xhr.setRequestHeader('Authorization', 'Bearer ' + localStorage.getItem(AUTH_TOKEN_KEY));
    xhr.setRequestHeader('x-tenant-id', 'laska');
    xhr.timeout = 120_000;
    xhr.upload.onprogress = event => { if (event.lengthComputable && event.total > 0) postQueueProgress(Math.min(99, Math.round(event.loaded / event.total * 100))); };
    xhr.onerror = () => reject(new Error('Немає з’єднання'));
    xhr.ontimeout = () => reject(new Error('Перевищено час завантаження'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { postQueueProgress(100); resolve(); }
      else reject(new Error('HTTP ' + xhr.status));
    };
    xhr.send(data);
  });
}
function currentEmail(): string {
  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    const user = raw ? JSON.parse(raw) as { email?: string } : null;
    return (user?.email ?? '').trim().toLowerCase();
  } catch { return ''; }
}
async function processPhotoOutbox(): Promise<void> {
  if (outboxRunning || !navigator.onLine || !window.localStorage.getItem(AUTH_TOKEN_KEY)
      || getActiveTenant() !== 'laska') return;
  outboxRunning = true;
  try {
    const owner = currentEmail();
    if (!owner) return;
    const queued = (await photoOutbox.toArray()).filter(row => row.owner.toLowerCase() === owner);
    for (const item of queued) {
      if (!navigator.onLine || getActiveTenant() !== 'laska' || currentEmail() !== owner) break;
      if (!item.store || !item.photos.length || item.photos.some(photo => photo.latitude == null || photo.longitude == null)) continue;
      const data = new FormData();
      data.set('id', item.id);
      data.set('routeId', item.store.id);
      data.set('reportDate', item.date);
      data.set('category', item.category);
      data.set('comment', item.comment);
      data.set('photoLocations', JSON.stringify(item.photos.map(photo => ({ latitude: photo.latitude, longitude: photo.longitude }))));
      for (const { file } of item.photos) data.append('photos', file, 'photo.jpg');
      try {
        postQueueProgress(0);
        await uploadPhotoReport(data);
        await photoOutbox.delete(item.id);
        window.dispatchEvent(new Event(queueEvent));
      } catch {
        // Do not delete the local copy on failure. Retry when online / app is active.
        break;
      }
    }
  } catch {
    // Storage can become temporarily unavailable; keep queued data untouched.
  } finally {
    outboxRunning = false;
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void processPhotoOutbox());
  window.addEventListener('focus', () => void processPhotoOutbox());
  window.setInterval(() => void processPhotoOutbox(), 30_000);
  void processPhotoOutbox();
}
const emptyFilters = { from: '', to: '', department: '', agent: '', search: '' };
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
  const role = getUserRole(draft.owner);
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
  const [preparing, setPreparing] = useState(0);
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
    enabled: !value.store && (search.length >= 2 || Boolean(storeDepartment) || Boolean(storeAgent)),
    retry: false,
  });

  async function requestLocation(): Promise<{ latitude: number; longitude: number }> {
    if (!navigator.geolocation) throw new Error('Геолокація недоступна. Фото збережене — увімкніть GPS та повторіть.');
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        position => resolve({latitude: position.coords.latitude, longitude: position.coords.longitude}),
        () => reject(new Error('Не вдалося отримати GPS. Фото збережене — повторіть визначення координат.')),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
      );
    });
  }

  async function retryLocation() {
    setBusy(true);
    setLocationError('');
    try {
      const location = await requestLocation();
      setValue(current => ({ ...current, photos: current.photos.map(photo =>
        photo.latitude == null || photo.longitude == null ? { ...photo, ...location } : photo) }));
    } catch (error) { setLocationError(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function addPhotos(files: File[]) {
    if (!files.length) return;
    if (value.photos.length + files.length > 5) {
      setFeedback('Можна додати до п’яти фото.');
      return;
    }
    setBusy(true);
    setPreparing(0);
    setFeedback('');
    setLocationError('');
    const nextPhotos: Draft['photos'] = [];
    try {
      for (const [index, file] of files.entries()) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          throw new Error('Виберіть фото JPG, PNG або WebP.');
        }
        const compressed = await imageCompression(file, {
          maxSizeMB: 1.5, maxWidthOrHeight: 2400, useWebWorker: true, fileType: 'image/jpeg',
        });
        if (compressed.size > 5 * 1024 * 1024) throw new Error('Фото перевищує 5 МБ.');
        nextPhotos.push({ id: crypto.randomUUID(), file: compressed, latitude: null, longitude: null });
        setPreparing(Math.round((index + 1) / files.length * 100));
      }
      const savedSnapshot = { ...valueRef.current, photos: [...valueRef.current.photos, ...nextPhotos] };
      // Persist photos before GPS: a slow/failed location request must never force a re-take.
      await persistDraft(savedSnapshot);
      valueRef.current = savedSnapshot;
      setValue(savedSnapshot);
      try {
        const location = await requestLocation();
        setValue(current => ({ ...current, photos: current.photos.map(photo =>
          nextPhotos.some(newPhoto => newPhoto.id === photo.id) ? { ...photo, ...location } : photo) }));
      } catch (error) {
        setLocationError(errorMessage(error));
      }
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusy(false);
      setPreparing(0);
    }
  }

  async function save() {
    if (busy) return;
    setFeedback('');
    if (value.photos.some(photo => photo.latitude == null || photo.longitude == null)) {
      setFeedback('Геолокація обов’язкова для кожного фото. Чернетка залишається на пристрої.');
      return;
    }
    if (!value.store || !value.photos.length) {
      setFeedback('Виберіть торгову точку й додайте хоча б одне фото.');
      return;
    }
    // Only queue after the latest autosave is durable. Never block on network.
    setBusy(true);
    try {
      // Fix the report date to the Kyiv calendar day when the user submits.
      valueRef.current = { ...valueRef.current, date: reportDate.format(new Date()), category: 'merchandising' };
      await flushDraft();
      await database.transaction('rw', drafts, photoOutbox, async () => {
        await photoOutbox.put(valueRef.current);
        await drafts.delete(valueRef.current.owner);
      });
      submitted.current = true;
      onSaved();
      void processPhotoOutbox();
    } catch {
      setDraftStatus('error');
      setFeedback('Не вдалося поставити звіт у чергу. Фото залишаються у чернетці. Перевірте місце на пристрої.');
    } finally {
      if (!submitted.current) setBusy(false);
    }
  }

  return <form id="laska-photo-create-form" className={`${styles.panel} ${styles.createForm}`} onSubmit={event => { event.preventDefault(); void save(); }}>
    <fieldset className={styles.createFieldset} disabled={busy}>
      <legend className={styles.visuallyHidden}>Новий фотозвіт</legend>
      <div className={styles.filters}>
        <label>Відділ<select value={storeDepartment} onChange={event => {
          setStoreDepartment(event.target.value);
          setStoreAgent('');
          setValue(current => ({ ...current, store: null }));
        }}>
          <option value="">{role === 'supervisor' || role === 'agent' ? 'Мої відділи' : 'Усі відділи'}</option>
          {departments.map(item => <option key={item} value={item}>{item}</option>)}
        </select></label>
        <label>Торговий представник<select value={storeAgent} onChange={event => {
          setStoreAgent(event.target.value);
          setValue(current => ({ ...current, store: null }));
        }}>
          <option value="">{role === 'agent' ? 'Мій профіль' : role === 'supervisor' ? 'Мої торгові агенти' : 'Усі торгові агенти'}</option>
          {agents.map(item => <option key={item} value={item}>{item}</option>)}
        </select></label>
      </div>
      {availableAssignments.isError && <p role="alert">Не вдалося завантажити доступні відділи та торгових. <button type="button" onClick={() => void availableAssignments.refetch()}>Повторити</button></p>}
      {value.store ? <div className={styles.toolbar}>
        <strong>{value.store.store_name} · {value.store.agent_name}</strong>
        <button type="button" onClick={() => setValue(current => ({ ...current, store: null }))}>Змінити точку</button>
      </div> : <>
        <label>Торгова точка<input type="search" maxLength={200} value={storeSearch}
          placeholder="Пошук за назвою або вибір через фільтри"
          onChange={event => setStoreSearch(event.target.value)} /></label>
        {(search.length >= 2 || Boolean(storeDepartment) || Boolean(storeAgent)) && <>
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
      <label>Коментар<textarea rows={3} maxLength={1000} value={value.comment}
        onChange={event => setValue(current => ({ ...current, comment: event.target.value }))} /></label>
      <div className={styles.cameraActions}>
        <button type="button" className={styles.galleryPick} onClick={() => gallery.current?.click()} disabled={value.photos.length >= 5}><svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/></svg><span>З галереї</span></button>
        <button type="button" className={styles.cameraMain} onClick={() => camera.current?.click()} disabled={value.photos.length >= 5} aria-label="Зробити фото">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h4l2-3h4l2 3h6v12H4z"/><circle cx="12" cy="13" r="4"/></svg>
        </button>
        <span className={styles.cameraCount}>Фото {value.photos.length}/5 · GPS</span>
        {[camera, gallery].map((ref, index) => <input key={index} hidden ref={ref} type="file"
          accept="image/jpeg,image/png,image/webp" capture={index === 0 ? 'environment' : undefined}
          multiple={index === 1} onChange={event => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = '';
            void addPhotos(files);
          }} />)}
      </div>
      {locationError && <p role="alert">{locationError} <button type="button" onClick={() => void retryLocation()}>Повторити GPS</button></p>}
      {busy && preparing > 0 && <p role="status">Підготовка фото: {preparing}% <progress max={100} value={preparing} /></p>}
      {value.photos.length > 0 && <div className={styles.photos}>{value.photos.map(({ id, file, latitude, longitude }, index) =>
        <div key={id}><FilePreview file={file} /><small>{latitude != null && longitude != null ? `📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : '⚠️ Немає GPS'}</small>
          <button type="button" aria-label={`Прибрати фото ${index + 1}`} onClick={() =>
            setValue(current => ({ ...current, photos: current.photos.filter(photo => photo.id !== id) }))}>Прибрати</button>
        </div>)}</div>}
    </fieldset>
    {draftStatus === 'error' && <p role="alert">Не вдалося автоматично зберегти чернетку.</p>}
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
  const role = getUserRole(email);
  const [saved, setSaved] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<{ report: Report; index: number } | null>(null);
  const [galleryNotice, setGalleryNotice] = useState('');
  const touchStart = useRef<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const client = useQueryClient();
  const queryKey = [endpoint, email];
  useEffect(() => {
    const progress = (event: Event) => setUploadProgress((event as CustomEvent<number>).detail);
    const refresh = () => {
      void photoOutbox.toArray().then(rows => setQueuedCount(rows.filter(row => row.owner.toLowerCase() === email.toLowerCase()).length));
      void client.invalidateQueries({ queryKey: [endpoint, email] });
    };
    window.addEventListener(queueProgressEvent, progress);
    window.addEventListener(queueEvent, refresh);
    refresh();
    return () => { window.removeEventListener(queueProgressEvent, progress); window.removeEventListener(queueEvent, refresh); };
  }, [email, client]);

  async function deleteGalleryPhoto(report: Report, index: number) {
    const key = report.id + ':' + index;
    setDeleting(key);
    try {
      const response = await fetch(new URL(endpoint + '/' + report.id + '/photos/' + index, API_BASE_URL), {
        method: 'DELETE', headers: { Authorization: 'Bearer ' + localStorage.getItem(AUTH_TOKEN_KEY), 'x-tenant-id': 'laska' },
      });
      if (!response.ok) throw new Error((await response.json() as { message?: string }).message || 'Помилка видалення');
      await client.invalidateQueries({ queryKey: [endpoint, email] });
      setGalleryNotice('Фото видалено.');
      setConfirmDelete(null);
      setSelectedIndex(index => Math.max(0, index - 1));
    } catch (error) { setGalleryNotice(errorMessage(error)); }
    finally { setDeleting(null); }
  }

  const reportList = useQuery({
    queryKey: [...queryKey, applied, page],
    queryFn: ({ signal }) => apiGet<{ rows: Report[]; hasNext: boolean }>(endpoint + '/grouped', {
      authenticated: true, query: { ...applied, page }, signal,
    }),
    retry: false,
    enabled: mode === 'gallery',
    staleTime: 60_000,
  });
  const stats = useQuery({
    queryKey: [...queryKey, 'stats', applied],
    queryFn: ({ signal }) => apiGet<{ storeCount: number; photoCount: number }>(endpoint + '/stats', {
      authenticated: true, query: applied, signal,
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
  const groupedStores = new Map<string, { name: string; code: string; agent: string; photos: { report: Report; index: number; url: string; latitude: number | null; longitude: number | null }[] }>();
  for (const report of reportList.data?.rows ?? []) {
    const key = (report.store_code || report.store_name) + '::' + report.report_date;
    if (!groupedStores.has(key)) groupedStores.set(key, { name: report.store_name, code: report.store_code, agent: report.agent_name, photos: [] });
    report.photos.forEach((photo, index) => groupedStores.get(key)?.photos.push({ ...photo, report, index }));
  }
  const storeCards = Array.from(groupedStores.entries());
  const selectedGroup = storeCards.find(([key]) => key === selectedStore)?.[1];
  const selectedPhoto = selectedGroup?.photos[selectedIndex];
  const movePhoto = (step: number) => {
    if (selectedGroup?.photos.length) setSelectedIndex(i => (i + step + selectedGroup.photos.length) % selectedGroup.photos.length);
  };
  // Resolve a human-readable shooting location only for the currently opened image.
  // The backend caches results and rate-limits the external geocoder.
  const hasGps = selectedPhoto?.latitude != null && selectedPhoto.longitude != null;
  const latitude = selectedPhoto?.latitude ?? null;
  const longitude = selectedPhoto?.longitude ?? null;
  const photoPlace = useQuery({
    queryKey: [...queryKey, 'reverse-location', latitude?.toFixed(4), longitude?.toFixed(4)],
    queryFn: ({ signal }) => apiGet<{ locality: string; address: string }>(endpoint + '/reverse-location', {
      authenticated: true, query: { latitude: latitude!, longitude: longitude! }, signal,
    }),
    enabled: mode === 'gallery' && Boolean(selectedStore) && hasGps,
    retry: false,
    staleTime: 30 * 86400_000,
    gcTime: 30 * 86400_000,
  });
  useEffect(() => {
    if (!selectedStore) return;
    const onKey = (event: KeyboardEvent) => {
      if (confirmDelete) return;
      if (event.key === 'Escape') setSelectedStore(null);
      if (event.key === 'ArrowLeft') movePhoto(-1);
      if (event.key === 'ArrowRight') movePhoto(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalidDates) return;
    setApplied(filters);
    setPage(1);
    if (page === 1 && Object.keys(filters).every(key => filters[key as keyof typeof filters] === applied[key as keyof typeof applied])) {
      void reportList.refetch();
      void stats.refetch();
    }
  }

  return <section className={`${styles.page} ${mode === 'create' ? styles.createPage : ''}`} aria-label="Фотозвіт">
    <div className={styles.reportHeader}>
      <h1>{mode === 'gallery' ? 'Галерея' : 'Фотозвіт'}</h1>
    {mode === 'create' && <button className={styles.sendReport} type="submit" form="laska-photo-create-form">
      <span className={styles.sendLabel}>{queuedCount > 0 ? 'Надсилання фотозвіту' : 'Надіслати фотозвіт'}</span>
      {queuedCount > 0 && <span className={styles.sendDetail}>У черзі: {queuedCount} · {uploadProgress == null ? 'Очікування мережі' : `${uploadProgress}%`}</span>}
      {queuedCount > 0 && <span className={styles.sendProgressTrack} aria-hidden="true"><span style={{ width: `${uploadProgress ?? 0}%` }}/></span>}
    </button>}
    </div>
    {saved && <p role="status">Фотозвіт поставлено в чергу.</p>}
    {mode === 'create' && <DraftForm email={email} onSaved={() => {
      setSaved(true);
      setPage(1);
      void client.invalidateQueries({ queryKey });
    }} />}
    {mode === 'gallery' && <form className={styles.panel} onSubmit={applyFilters}>
      <div className={styles.filters}>
        <label>Дата від<input type="date" value={filters.from} onChange={event => setFilters({ ...filters, from: event.target.value })} /></label>
        <label>Дата до<input type="date" value={filters.to} onChange={event => setFilters({ ...filters, to: event.target.value })} /></label>
        <label>Відділ<select value={filters.department} onChange={event => setFilters({ ...filters, department: event.target.value, agent: '' })}>
          <option value="">{role === 'supervisor' || role === 'agent' ? 'Мої відділи' : 'Усі відділи'}</option>
          {departments.map(item => <option key={item}>{item}</option>)}
        </select></label>
        <label>Торговий агент<select value={filters.agent} onChange={event => setFilters({ ...filters, agent: event.target.value })}>
          <option value="">{role === 'agent' ? 'Мій профіль' : role === 'supervisor' ? 'Мої торгові агенти' : 'Усі торгові агенти'}</option>
          {agents.map(item => <option key={item}>{item}</option>)}
        </select></label>
        <label>Торгова точка<input type="search" maxLength={200} placeholder="Назва або код"
          value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} /></label>

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
      <div className={styles.statCard}><span>Кількість ТТ</span><strong>{stats.data?.storeCount ?? '—'}</strong></div>
      <div className={styles.statCard}><span>Кількість фото</span><strong>{stats.data?.photoCount ?? '—'}</strong></div>
    </div>}
    {mode === 'gallery' && galleryNotice && <div className={styles.appNotice} role="status"><span>{galleryNotice}</span><button type="button" onClick={() => setGalleryNotice('')}>Закрити</button></div>}
    {mode === 'gallery' && <div className={styles.galleryGrid}>{storeCards.map(([key, group]) =>
      <article key={key} className={styles.galleryCard}>
        <button type="button" className={styles.galleryImageButton} onClick={() => { setSelectedStore(key); setSelectedIndex(0); }} aria-label={`Переглянути фото: ${group.name}`}>
          {group.photos[0] && <img src={group.photos[0].url} loading="lazy" referrerPolicy="no-referrer" alt={group.name} />}
          <span className={styles.photoCounter}>📷 {group.photos.length} фото</span>
        </button>
        <div className={styles.galleryInfo}><strong>ТТ: {group.name}</strong><span>{group.photos[0]?.report.report_date.split('-').reverse().join('.')} · {group.code} · {group.agent}</span></div>
      </article>
    )}</div>}
    {mode === 'gallery' && selectedStore && selectedGroup && selectedPhoto && <div className={styles.viewer} role="presentation" onClick={() => setSelectedStore(null)}>
      <section className={styles.photoDialog} role="dialog" aria-modal="true" aria-label={`Фотографії торгової точки ${selectedGroup.name}`}
        onClick={event => event.stopPropagation()}
        onTouchStart={event => { touchStart.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={event => {
          if (touchStart.current === null) return;
          const delta = event.changedTouches[0].clientX - touchStart.current;
          if (Math.abs(delta) > 55) movePhoto(delta > 0 ? -1 : 1);
          touchStart.current = null;
        }}>
        <div className={styles.dialogTop}>
          <div><strong>{selectedGroup.name}</strong><small>{selectedGroup.code} · {selectedPhoto.report.agent_name} · {selectedIndex + 1} із {selectedGroup.photos.length}</small></div>
          <button type="button" onClick={() => setSelectedStore(null)} aria-label="Закрити перегляд">✕</button>
        </div>
        <div className={styles.carouselPhoto}>
          <img src={selectedPhoto.url} alt={`Фото ${selectedIndex + 1}: ${selectedGroup.name}`} />
          {selectedGroup.photos.length > 1 && <>
            <button type="button" className={styles.carouselArrow} onClick={() => movePhoto(-1)} aria-label="Попереднє фото">‹</button>
            <button type="button" className={styles.carouselArrow} onClick={() => movePhoto(1)} aria-label="Наступне фото">›</button>
          </>}
          <button type="button" className={styles.galleryDelete} onClick={() => setConfirmDelete({ report: selectedPhoto.report, index: selectedPhoto.index })} aria-label="Видалити фото"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v7M14 10v7"/></svg>Видалити</button>
        </div>
        <div className={styles.photoMeta}><span>{selectedPhoto.report.report_date.split('-').reverse().join('.')} · {categories[selectedPhoto.report.category]}</span></div>
        {selectedPhoto.report.comment && <p className={styles.photoComment}>{selectedPhoto.report.comment}</p>}
        <a className={styles.placeInfo} aria-label="Відкрити місце фотозйомки в Google Maps" href={hasGps ? `https://www.google.com/maps/search/?api=1&query=${latitude}%2C${longitude}` : undefined} target="_blank" rel="noopener noreferrer" aria-live="polite">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
          <div>
            {!hasGps ? <strong>Геолокація відсутня</strong> :
              photoPlace.data?.locality ? <strong>{photoPlace.data.locality}</strong> :
              photoPlace.isFetching ? <strong>Визначаємо населений пункт…</strong> : <strong>Населений пункт не визначено</strong>}
            {photoPlace.data?.address && <span>{photoPlace.data.address}</span>}
            {hasGps && <span className={styles.coordinates}>GPS: {latitude?.toFixed(5)}, {longitude?.toFixed(5)}</span>}
          </div>
          {hasGps && <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 4h6v6M20 4l-9 9"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/></svg>}
        </a>

      </section>
    </div>}
    {confirmDelete && <AppDialog title="Видалити фото?" message="Фото буде назавжди видалене з Neon і Cloudinary. Цю дію не можна скасувати." onClose={() => setConfirmDelete(null)}
      onConfirm={() => void deleteGalleryPhoto(confirmDelete.report, confirmDelete.index)} confirmLabel="Видалити" destructive busy={deleting !== null} />}
    {mode === 'gallery' && (page > 1 || reportList.data?.hasNext) && <nav className={styles.toolbar} aria-label="Сторінки фотозвітів">
      <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Попередня</button>
      <span>Сторінка {page}</span>
      <button type="button" disabled={!reportList.data?.hasNext} onClick={() => setPage(page + 1)}>Наступна</button>
    </nav>}
  </section>;
}
