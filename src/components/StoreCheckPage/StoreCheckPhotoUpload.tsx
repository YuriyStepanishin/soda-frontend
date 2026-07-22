import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type ChangeEvent,
} from 'react';
import imageCompression from 'browser-image-compression';
import exifr from 'exifr';

import { uploadStoreCheckPhoto } from '../../api/saveStoreCheck';
import { storeCheckPhotoDB, type StoreCheckPhoto } from './storeCheckPhotoDB';
import styles from './StoreCheckPhotoUpload.module.css';

interface Props {
  ttName: string;
  department: string;
  representative: string;
  date: string;
}

const MAX_PHOTOS = 7;

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1.5,
  maxWidthOrHeight: 2600,
  initialQuality: 0.9,
  useWebWorker: true,
};

function formatDateOnlyLocal(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
async function readPhotoMeta(file: File): Promise<{
  capturedAt?: string;
  device?: string;
}> {
  try {
    const exif = await exifr.parse(file, {
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'DateTimeDigitized',
        'Make',
        'Model',
      ],
    });

    const rawDate =
      (exif?.DateTimeOriginal as Date | undefined) ||
      (exif?.CreateDate as Date | undefined) ||
      (exif?.DateTimeDigitized as Date | undefined);

    const capturedAt =
      rawDate instanceof Date && !Number.isNaN(rawDate.getTime())
        ? formatDateOnlyLocal(rawDate)
        : undefined;

    const make = String(exif?.Make || '').trim();
    const model = String(exif?.Model || '').trim();
    const device = [make, model].filter(Boolean).join(' ').trim() || undefined;

    return { capturedAt, device };
  } catch {
    return {};
  }
}

export default function StoreCheckPhotoUpload({
  ttName,
  department,
  representative,
  date,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<StoreCheckPhoto[]>([]);
  const [processing, setProcessing] = useState(false);
  const isUploadingRef = useRef(false);

  const isCurrentFormPhoto = useCallback(
    (photo: StoreCheckPhoto) =>
      photo.ttName === ttName &&
      photo.department === department &&
      photo.representative === representative,
    [ttName, department, representative]
  );

  const refresh = useCallback(async () => {
    const rows = await storeCheckPhotoDB.photos
      .where('ttName')
      .equals(ttName)
      .and(isCurrentFormPhoto)
      .sortBy('createdAt');
    setPhotos(rows);
  }, [ttName, isCurrentFormPhoto]);

  const tryUploadAll = useCallback(async () => {
    if (isUploadingRef.current || !navigator.onLine) return;
    isUploadingRef.current = true;

    try {
      const toUpload = await storeCheckPhotoDB.photos
        .where('status')
        .anyOf(['pending', 'error'])
        .and(isCurrentFormPhoto)
        .toArray();

      for (const photo of toUpload) {
        if (!navigator.onLine) break;

        await storeCheckPhotoDB.photos.update(photo.id, {
          status: 'uploading',
        });
        await refresh();

        try {
          const result = await uploadStoreCheckPhoto({
            department: photo.department,
            representative: photo.representative,
            store: photo.ttName,
            createdDate: photo.date,
            photos: [
              {
                base64: photo.base64,
                type: photo.type,
                name: photo.name,
                capturedAt: photo.date,
                device: photo.device,
              },
            ],
          });

          if (result.success) {
            await storeCheckPhotoDB.photos.update(photo.id, {
              status: 'done',
            });
          } else {
            await storeCheckPhotoDB.photos.update(photo.id, {
              status: 'error',
            });
          }
        } catch {
          await storeCheckPhotoDB.photos.update(photo.id, {
            status: 'error',
          });
        }

        await refresh();
      }
    } finally {
      isUploadingRef.current = false;
    }
  }, [isCurrentFormPhoto, refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void tryUploadAll();

    const onOnline = () => void tryUploadAll();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [tryUploadAll]);

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    const currentCount = await storeCheckPhotoDB.photos
      .where('ttName')
      .equals(ttName)
      .and(isCurrentFormPhoto)
      .count();

    if (currentCount + files.length > MAX_PHOTOS) {
      alert(`Максимум ${MAX_PHOTOS} фото`);
      e.target.value = '';
      return;
    }

    try {
      setProcessing(true);

      for (const file of files) {
        const meta = await readPhotoMeta(file);
        const compressed = await imageCompression(file, COMPRESSION_OPTIONS);

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(compressed);
        });

        const photo: StoreCheckPhoto = {
          id: crypto.randomUUID(),
          base64,
          type: compressed.type,
          name: compressed.name,
          status: 'pending',
          ttName,
          department,
          representative,
          date: meta.capturedAt || date,
          device: meta.device,
          createdAt: Date.now(),
        };

        await storeCheckPhotoDB.photos.put(photo);
      }

      await refresh();
      void tryUploadAll();
    } catch {
      // silently fail — photo stays as pending
    } finally {
      setProcessing(false);
    }

    e.target.value = '';
  }

  async function removePhoto(id: string) {
    await storeCheckPhotoDB.photos.delete(id);
    await refresh();
  }

  const pendingCount = photos.filter(
    p => p.status === 'pending' || p.status === 'uploading'
  ).length;
  const doneCount = photos.filter(p => p.status === 'done').length;
  const errorCount = photos.filter(p => p.status === 'error').length;

  return (
    <div className={styles.container}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className={styles.hiddenInput}
      />

      <div className={styles.row}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={processing || photos.length >= MAX_PHOTOS}
          className={styles.photoButton}
        >
          📷 Фото{photos.length > 0 ? ` (${photos.length})` : ''}
        </button>

        <div className={styles.statuses}>
          {pendingCount > 0 && (
            <span className={styles.statusPending}>⏳ {pendingCount}</span>
          )}
          {doneCount > 0 && (
            <span className={styles.statusDone}>✓ {doneCount}</span>
          )}
          {errorCount > 0 && (
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => void tryUploadAll()}
            >
              ✕ {errorCount} повтор
            </button>
          )}
        </div>
      </div>

      {photos.length > 0 && (
        <div className={styles.thumbnails}>
          {photos.map(photo => (
            <div key={photo.id} className={styles.thumb}>
              <img
                src={`data:${photo.type};base64,${photo.base64}`}
                className={styles.thumbImg}
                alt=""
              />
              <span
                className={`${styles.thumbStatus} ${styles[`status_${photo.status}`]}`}
              >
                {photo.status === 'done'
                  ? '✓'
                  : photo.status === 'uploading'
                    ? '⟳'
                    : photo.status === 'error'
                      ? '✕'
                      : '⏳'}
              </span>
              {photo.status !== 'uploading' && (
                <button
                  type="button"
                  onClick={() => void removePhoto(photo.id)}
                  className={styles.removeBtn}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
