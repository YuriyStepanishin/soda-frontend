import { useState } from 'react';
import { useSaveBonusReportMutation } from '../../hooks/api/useReportMutations';

import PhotoUpload from '../PhotoUpload/PhotoUpload';
import Loader from '../Loader/Loader';
import Popup from '../Popup/Popup';

import styles from './PhotoReport.module.css';
import type { Photo } from '../../types/photo';
import { db } from '../PhotoUpload/db';
import { openDatePicker } from '../../utils/openDatePicker';

interface Props {
  storeData: {
    department: string;
    representative: string;
    store: string;
  };

  onBack: () => void;
}

export default function ReportBonusForm({ storeData, onBack }: Props) {
  const [createdDate, setCreatedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const [category, setCategory] = useState('');

  const [comment, setComment] = useState('');

  const [photos, setPhotos] = useState<Photo[]>([]);

  const [success, setSuccess] = useState(false);
  const [popupMessage, setPopupMessage] = useState<string | null>(null);

  const saveMutation = useSaveBonusReportMutation();

  async function handleSave() {
    if (!createdDate) {
      setPopupMessage('Оберіть дату створення');
      return;
    }

    if (!category) {
      setPopupMessage('Оберіть категорію');
      return;
    }

    try {
      const dbPhotos = await db.photos.toArray();
      const captureDate = dbPhotos.find(photo => photo.capturedAt)?.capturedAt;

      const result = await saveMutation.mutateAsync({
        department: storeData.department,
        representative: storeData.representative,
        store: storeData.store,
        createdDate: captureDate || createdDate,
        category,
        comment,
        photos: dbPhotos,
      });

      if (result.success) {
        setSuccess(true);

        setComment('');
        setPhotos([]);
        await db.photos.clear();

        setTimeout(onBack, 1500);
      } else {
        setPopupMessage(result.error || 'Помилка');
      }
    } catch {
      setPopupMessage('Server error');
    }
  }

  return (
    <div className={styles.wrapper}>
      {saveMutation.isPending && <Loader />}

      <div className={styles.title}>{storeData.store}</div>

      <div className={styles.subtitle}>
        {storeData.department} • {storeData.representative}
      </div>

      <label className={styles.label}>Дата створення</label>

      <input
        type="date"
        value={createdDate}
        onClick={e => openDatePicker(e.currentTarget)}
        onChange={e => setCreatedDate(e.target.value)}
        className={styles.input}
      />

      <label className={styles.label}>Категорія</label>

      <select
        value={category}
        onChange={e => setCategory(e.target.value)}
        className={styles.input}
      >
        <option value="">Оберіть категорію</option>

        <option value="1">1 (1–6 м.)</option>
        <option value="2">2 (6–9 м.)</option>
        <option value="3">3 (9–15 м.)</option>
        <option value="4">4 (15–30 м.)</option>
        <option value="5">5 (30+ м.)</option>
      </select>

      <PhotoUpload photos={photos} setPhotos={setPhotos} />

      <label className={styles.label}>Коментар</label>

      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        className={styles.textarea}
      />

      {success && (
        <div className={styles.successMessage}>✅ Звіт успішно збережено</div>
      )}

      {popupMessage && (
        <Popup message={popupMessage} onClose={() => setPopupMessage(null)} />
      )}

      <div className={styles.bottomRow}>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className={styles.saveButton}
        >
          {saveMutation.isPending ? 'Збереження...' : 'ЗБЕРЕГТИ'}
        </button>

        <button onClick={onBack} className={styles.cancelButton}>
          Скасувати
        </button>
      </div>
    </div>
  );
}
