import { useRef, useState, type ChangeEvent } from 'react';
import imageCompression from 'browser-image-compression';
import exifr from 'exifr';
import styles from './PhotoUpload.module.css';
import { db } from './db';
import type { Photo } from '../../types/photo';
import Loader from '../Loader/Loader';
import Popup from '../Popup/Popup';

interface Props {
  photos: Photo[];
  setPhotos: React.Dispatch<React.SetStateAction<Photo[]>>;
}

export default function PhotoUpload({ photos, setPhotos }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [popupMessage, setPopupMessage] = useState<string | null>(null);

  const compressionOptions = {
    maxSizeMB: 1.5,
    maxWidthOrHeight: 2600,
    initialQuality: 0.9,
    useWebWorker: true,
  };

  function formatDateOnlyLocal(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
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
      const device =
        [make, model].filter(Boolean).join(' ').trim() || undefined;

      return { capturedAt, device };
    } catch {
      return {};
    }
  }

  async function fileToBase64(file: File): Promise<Photo> {
    const meta = await readPhotoMeta(file);
    const compressed = await imageCompression(file, compressionOptions);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];

        resolve({
          id: crypto.randomUUID(),
          base64,
          type: compressed.type,
          name: compressed.name,
          capturedAt: meta.capturedAt,
          device: meta.device,
          status: 'pending',
        });
      };

      reader.onerror = reject;
      reader.readAsDataURL(compressed);
    });
  }

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);

    if (photos.length + files.length > 3) {
      setPopupMessage('Максимум 3 фото');
      return;
    }

    try {
      setProcessing(true);
      const newPhotos = await Promise.all(files.map(fileToBase64));

      for (const p of newPhotos) {
        await db.photos.put(p);
      }

      const fresh = await db.photos.toArray();
      setPhotos(fresh);
    } catch (err) {
      console.error(err);
      setPopupMessage('Помилка обробки фото');
    } finally {
      setProcessing(false);
    }

    e.target.value = '';
  }

  async function removePhoto(id: string) {
    try {
      setProcessing(true);
      await db.photos.delete(id);

      const fresh = await db.photos.toArray();
      setPhotos(fresh);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className={styles.container}>
      {processing && <Loader />}

      <label className={styles.label}>Фото (макс 3)</label>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className={styles.hiddenInput}
      />

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleChange}
        className={styles.hiddenInput}
      />

      <div className={styles.buttons}>
        <button
          onClick={() => cameraRef.current?.click()}
          className={styles.button}
          disabled={processing}
        >
          📷 Зробити фото
        </button>

        <button
          onClick={() => galleryRef.current?.click()}
          className={styles.button}
          disabled={processing}
        >
          🖼 З галереї
        </button>
      </div>

      <div className={styles.previewContainer}>
        {photos.map(photo => (
          <div key={photo.id} className={styles.previewItem}>
            <img
              src={`data:${photo.type};base64,${photo.base64}`}
              className={styles.previewImage}
            />

            <button
              onClick={() => removePhoto(photo.id)}
              className={styles.removeButton}
              disabled={processing}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {popupMessage && (
        <Popup message={popupMessage} onClose={() => setPopupMessage(null)} />
      )}
    </div>
  );
}
