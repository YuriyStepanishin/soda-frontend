import { useState, useRef, useMemo } from 'react';
import styles from './PhotoGallery.module.css';
import { useQuery } from '@tanstack/react-query';
import SearchInput from '../SearchInput';
import {
  buildImageSources,
  deletePhoto,
  extractDriveId,
  fetchReports,
  normalizePhotoUrls,
  type Report,
} from '../../api/fetchReports';
import { fetchSales } from '../../api/fetchOlgatorgSales';
import { queryKeys } from '../../api/queryKeys';
import Loader from '../Loader/Loader';
import Popup from '../Popup/Popup';
import {
  getCurrentAuthorizedEmail,
  getUserRepresentative,
  getUserRole,
} from '../../config/userRoles';

interface Props {
  onBack: () => void;
}

type Photo = {
  id: string;
  sources: string[];
  store: string;
  category: string;
  date: string;
  lat: number;
  lng: number;
  department: string;
  rep: string;
  comment: string;
  driveId: string;
};

export default function PhotoGallery({ onBack }: Props) {
  const authEmail = getCurrentAuthorizedEmail();
  const userRole = getUserRole(authEmail);
  const ownRepresentative = getUserRepresentative(authEmail);
  const isSupervisor = userRole === 'supervisor';
  const isAgent = userRole === 'agent';
  const canDelete = userRole === 'admin' || userRole === 'supervisor';
  const [deletedDriveIds, setDeletedDriveIds] = useState<Set<string>>(
    new Set()
  );
  const [pendingDeletePhoto, setPendingDeletePhoto] = useState<Photo | null>(
    null
  );
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [department, setDepartment] = useState('all');
  const [rep, setRep] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceIndexByPhotoId, setSourceIndexByPhotoId] = useState<
    Record<string, number>
  >({});

  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const lastTouch = useRef<number | null>(null);
  const lastDistance = useRef<number | null>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);

  function getDistance(touches: React.TouchList) {
    const a = touches[0];
    const b = touches[1];
    if (!a || !b) return 0;

    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  const {
    data: photos = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.photoReports,
    queryFn: fetchReports,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    select: (reports: Report[]): Photo[] => {
      const transformed = reports
        .filter(report => {
          const category = report.category.trim().toLowerCase();
          return category !== 'storecheck' && category !== 'сторчек';
        })
        .flatMap((report, reportIndex) =>
          normalizePhotoUrls(report.photos).map((rawUrl, photoIndex) => {
            const sources = buildImageSources(rawUrl);
            if (sources.length === 0) return null;

            return {
              id: `${report.date}-${report.store}-${reportIndex}-${photoIndex}`,
              sources,
              store: report.store,
              category: report.category,
              date: report.date,
              lat: 0,
              lng: 0,
              department: report.department,
              rep: report.representative,
              comment: report.comment ?? '',
              driveId: extractDriveId(rawUrl),
            };
          })
        );

      return transformed.filter((photo): photo is Photo => photo !== null);
    },
  });

  const departments = useMemo(() => {
    return [
      'all',
      ...Array.from(new Set(photos.map(p => p.department).filter(Boolean))),
    ];
  }, [photos]);

  const reps = useMemo(() => {
    return [
      'all',
      ...Array.from(
        new Set(
          photos
            .filter(p => department === 'all' || p.department === department)
            .map(p => p.rep)
            .filter(Boolean)
        )
      ),
    ];
  }, [photos, department]);

  const storeNameCollator = useMemo(
    () => new Intl.Collator('uk', { sensitivity: 'base' }),
    []
  );

  const parsePhotoDate = (raw: string): number => {
    if (!raw) return 0;

    const dmy = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\D|$)/);
    if (dmy) {
      const day = Number(dmy[1]);
      const month = Number(dmy[2]);
      const yearToken = dmy[3];
      const year = Number(
        yearToken.length === 2 ? `20${yearToken}` : yearToken
      );
      const parsed = new Date(year, month - 1, day).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    }

    const parsed = new Date(raw).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const filteredPhotos = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return photos
      .filter(p => {
        const depOk = department === 'all' || p.department === department;
        const repOk = rep === 'all' || p.rep === rep;
        const searchOk = !query || p.store.toLowerCase().includes(query);
        const notDeleted = !deletedDriveIds.has(p.driveId);

        return depOk && repOk && searchOk && notDeleted;
      })
      .sort((a, b) => {
        const dateDiff = parsePhotoDate(b.date) - parsePhotoDate(a.date);
        if (dateDiff !== 0) return dateDiff;

        return storeNameCollator.compare(a.store, b.store);
      });
  }, [photos, department, rep, searchTerm, storeNameCollator, deletedDriveIds]);

  const filteredStoreCount = useMemo(() => {
    return new Set(filteredPhotos.map(photo => photo.store).filter(Boolean))
      .size;
  }, [filteredPhotos]);

  const filteredPhotoCount = filteredPhotos.length;

  const { data: sales = [] } = useQuery({
    queryKey: queryKeys.sales,
    queryFn: fetchSales,
    staleTime: 1000 * 60 * 5,
  });

  const storeSums = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const cutoff70 = new Date(now);
    cutoff70.setDate(cutoff70.getDate() - 70);

    function parseSaleDate(raw: string): Date | null {
      if (!raw) return null;
      const dmy = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
      if (dmy) return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}`);
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    }

    const result: Record<string, { month: number; days70: number }> = {};

    for (const sale of sales) {
      const key = sale.торгова_точка;
      if (!key) continue;
      if (!result[key]) result[key] = { month: 0, days70: 0 };

      const saleDate = parseSaleDate(sale.дата);
      if (!saleDate) continue;

      const saleDateMonth = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
      if (saleDateMonth === currentMonth) result[key].month += sale.сума;
      if (saleDate >= cutoff70) result[key].days70 += sale.сума;
    }
    return result;
  }, [sales]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastDistance.current = getDistance(e.touches);
    }

    const now = Date.now();
    if (lastTouch.current && now - lastTouch.current < 300) {
      setZoom(prev => (prev > 1 ? 1 : 2));
    }
    lastTouch.current = now;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = getDistance(e.touches);

      if (lastDistance.current) {
        const scale = distance / lastDistance.current;
        setZoom(prev => Math.min(Math.max(prev * scale, 1), 5));
      }

      lastDistance.current = distance;
    }

    if (e.touches.length === 1 && zoom > 1) {
      const touch = e.touches[0];

      if (lastPoint.current) {
        const dx = touch.clientX - lastPoint.current.x;
        const dy = touch.clientY - lastPoint.current.y;

        setPosition(prev => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }));
      }

      lastPoint.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
    }
  };

  const handleTouchEnd = () => {
    lastDistance.current = null;
    lastPoint.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLImageElement>) => {
    e.preventDefault();

    setZoom(prev => {
      const next = Math.min(Math.max(prev - e.deltaY * 0.01, 1), 5);
      if (next === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (zoom <= 1 || e.button !== 0) return;
    isDragging.current = true;
    lastPoint.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isDragging.current || zoom <= 1 || !lastPoint.current) return;

    const dx = e.clientX - lastPoint.current.x;
    const dy = e.clientY - lastPoint.current.y;

    setPosition(prev => ({
      x: prev.x + dx,
      y: prev.y + dy,
    }));

    lastPoint.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    lastPoint.current = null;
  };

  const handleDoubleClick = () => {
    setZoom(prev => {
      const next = prev > 1 ? 1 : 2;
      if (next === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const confirmDeletePhoto = async () => {
    if (!pendingDeletePhoto) return;

    const photo = pendingDeletePhoto;
    if (photo.driveId) {
      try {
        await deletePhoto(photo.driveId);
      } catch {
        // Optimistic removal even if API fails
      }
    }
    setDeletedDriveIds(prev => new Set(prev).add(photo.driveId || photo.id));
    setPendingDeletePhoto(null);
  };

  const handleDeletePhoto = (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeletePhoto(photo);
  };

  if (isLoading) return <Loader />;
  if (error) return <div>Щось зламалось 😅</div>;

  return (
    <>
      <div className={styles.container}>
        <div
          className={`${styles.topBar} ${activePhoto ? styles.filtersHidden : ''}`}
        >
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
            ariaLabel="Пошук фото за торговою точкою"
            className={styles.searchInput}
          />

          {!isSupervisor && !isAgent && (
            <select
              className={styles.select}
              value={department}
              onChange={e => {
                setDepartment(e.target.value);
                setRep('all');
              }}
            >
              {departments.map(dep => (
                <option key={dep} value={dep}>
                  {dep === 'all' ? 'Усі відділи' : dep}
                </option>
              ))}
            </select>
          )}

          {isAgent ? (
            <div className={styles.lockedValue}>{ownRepresentative || '—'}</div>
          ) : (
            <select
              className={styles.select}
              value={rep}
              onChange={e => setRep(e.target.value)}
            >
              {reps.map(r => (
                <option key={r} value={r}>
                  {r === 'all' ? 'Усі торгові представники' : r}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className={styles.list}>
          {filteredPhotos.length === 0 && (
            <div className={styles.empty}>Немає фото</div>
          )}

          {filteredPhotos.map(photo => (
            <div
              key={photo.id}
              className={styles.card}
              onClick={() => {
                const sourceIndex = sourceIndexByPhotoId[photo.id] ?? 0;
                setActivePhoto(photo.sources[sourceIndex] || photo.sources[0]);
                setZoom(1);
                setPosition({ x: 0, y: 0 });
              }}
            >
              <img
                src={photo.sources[sourceIndexByPhotoId[photo.id] ?? 0]}
                loading="lazy"
                className={styles.image}
                onError={() => {
                  setSourceIndexByPhotoId(prev => {
                    const current = prev[photo.id] ?? 0;
                    const next = current + 1;

                    if (next >= photo.sources.length) return prev;

                    return {
                      ...prev,
                      [photo.id]: next,
                    };
                  });
                }}
              />

              <div className={styles.info}>
                <div className={styles.infoContent}>
                  <div>ТТ: {photo.store}</div>
                  <div>Категорія: {photo.category}</div>
                  <div>{photo.date}</div>
                  {photo.comment && (
                    <div className={styles.comment}>{photo.comment}</div>
                  )}
                  {storeSums[photo.store]?.days70 > 0 && (
                    <div className={styles.sums}>
                      Сума:{' '}
                      {storeSums[photo.store].month.toLocaleString('uk-UA')} грн
                      ( {storeSums[photo.store].days70.toLocaleString('uk-UA')}{' '}
                      грн )
                    </div>
                  )}
                </div>
                {canDelete && (
                  <button
                    className={styles.deleteBtn}
                    onClick={e => handleDeletePhoto(photo, e)}
                  >
                    Видалити
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          className={`${styles.backButton} ${activePhoto ? styles.backButtonHidden : ''}`}
          onClick={onBack}
        >
          ← Назад
        </button>
      </div>

      {activePhoto && (
        <div className={styles.viewer} onClick={() => setActivePhoto(null)}>
          <button
            className={styles.closeBtn}
            onClick={() => setActivePhoto(null)}
          >
            ✕
          </button>

          <img
            src={activePhoto}
            className={styles.viewerImage}
            onClick={e => e.stopPropagation()}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            }}
          />
        </div>
      )}

      {pendingDeletePhoto && (
        <Popup
          message={`Видалити фото для ТТ "${pendingDeletePhoto.store}"?\nФото буде видалене і в галереї, і на бекенді.`}
          onClose={() => setPendingDeletePhoto(null)}
          onConfirm={() => void confirmDeletePhoto()}
          confirmLabel="Видалити"
          cancelLabel="Скасувати"
        />
      )}
    </>
  );
}
