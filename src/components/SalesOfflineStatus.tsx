import { useEffect, useState } from 'react';
import { getSalesReadStatuses, OFFLINE_STATUS_EVENT } from '../api/salesOffline';

export default function SalesOfflineStatus({ daily = false, requestPaths }: { daily?: boolean; requestPaths?: string[] }) {
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh(value => value + 1);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    window.addEventListener(OFFLINE_STATUS_EVENT, update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener(OFFLINE_STATUS_EVENT, update);
    };
  }, []);
  const statuses = getSalesReadStatuses(requestPaths ?? (daily ? ['/api/sales/by-days', '/api/sales/by-days/filters'] : ['/api/sales/report', '/api/sales/filters']));
  const cached = statuses.filter(status => status.source === 'device');
  const oldest = Math.min(...(cached.length ? cached : statuses).map(status => status.savedAt));
  const storageFailed = statuses.some(status => status.storageFailed);
  return (
    <div role="status" style={{ background: cached.length || !navigator.onLine ? '#fff2ce' : '#e5effb', color: '#173553', padding: '10px 14px', borderRadius: 10, margin: '10px 0', fontSize: 14 }}>
      {!navigator.onLine ? 'Немає інтернету. ' : cached.length ? 'З’єднання із сервером нестабільне. ' : 'Є підключення до мережі. '}
      {cached.length ? 'Показано збережену копію. ' : ''}
      {Number.isFinite(oldest) ? `Дані станом на ${new Date(oldest).toLocaleString('uk-UA')}. ` : 'Завантажте потрібний звіт, щоб мати його без інтернету. '}
      {storageFailed ? 'Не вдалося зберегти дані на пристрої. ' : ''}
      {cached.length || !navigator.onLine ? 'Нові періоди потребують інтернету. Для оновлення повторно сформуйте звіт або натисніть «Оновити дані».' : ''}
    </div>
  );
}
