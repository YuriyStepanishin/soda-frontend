export const OFFLINE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export interface OfflineEntry {
  key: string;
  scope: string;
  savedAt: number;
  data: unknown;
  bytes: number;
}

export interface ReadCacheStorage {
  get(key: string): Promise<OfflineEntry | undefined>;
  put(entry: OfflineEntry): Promise<void>;
  removeScope(scope: string): Promise<void>;
}

export type ReadStatus = { source: 'network' | 'device'; savedAt: number; storageFailed?: boolean };

// Only exact requests can be replayed: never combine cached totals or invent periods.
export async function cachedRead<T>(args: {
  key: string;
  scope: string;
  storage: ReadCacheStorage;
  load: (hasCopy: boolean) => Promise<T>;
  isOffline: () => boolean;
  isCurrent: () => boolean;
  signal?: AbortSignal;
  now?: () => number;
  onStatus: (status: ReadStatus) => void;
}): Promise<T> {
  const now = args.now ?? Date.now;
  let storageFailed = false;
  let entry: OfflineEntry | undefined;
  try { entry = await args.storage.get(args.key); } catch { storageFailed = true; }
  const assertCurrent = () => {
    if (args.signal?.aborted || !args.isCurrent()) throw new DOMException('Запит скасовано', 'AbortError');
  };
  const replay = () => {
    assertCurrent();
    if (!entry || entry.scope !== args.scope || entry.savedAt > now() || now() - entry.savedAt > OFFLINE_MAX_AGE) {
      throw new Error('Немає збережених даних для цих параметрів. Підключіть інтернет і завантажте звіт.');
    }
    args.onStatus({ source: 'device', savedAt: entry.savedAt, storageFailed });
    return entry.data as T;
  };
  assertCurrent();
  if (args.isOffline()) return replay();
  let data: T;
  try {
    data = await args.load(Boolean(entry && entry.scope === args.scope && now() - entry.savedAt <= OFFLINE_MAX_AGE));
  } catch (error) {
    assertCurrent();
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    if (status === 401 || status === 403) {
      await args.storage.removeScope(args.scope).catch(() => {});
      throw error;
    }
    // Validation/access errors and explicit cancellations must never use fallback.
    if ((status > 0 && status < 500) || (error instanceof DOMException && error.name === 'AbortError')) throw error;
    if (entry) return replay();
    if (status > 0) throw error;
    throw new Error('Не вдалося отримати дані через мережу. Для цих параметрів немає збереженого звіту.');
  }
  assertCurrent();
  const savedAt = now();
  try {
    const bytes = new Blob([JSON.stringify(data)]).size;
    await args.storage.put({ key: args.key, scope: args.scope, savedAt, data, bytes });
  } catch { storageFailed = true; }
  assertCurrent();
  args.onStatus({ source: 'network', savedAt, storageFailed });
  return data;
}
