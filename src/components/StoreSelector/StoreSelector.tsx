import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  fetchStoreSelectorData,
  type StoreSelectorSource,
  type StoreSelectorRow,
} from '../../api/fetchOlgatorgStoreSelectorData';
import { queryKeys } from '../../api/queryKeys';
import Popup from '../Popup/Popup';
import Loader from '../Loader/Loader';
import BackButton from '../BackButton/BackButton';
import {
  getCurrentAuthorizedEmail,
  getUserRepresentative,
  getUserRole,
} from '../../config/userRoles';
import styles from './StoreSelector.module.css';

// Store selector for report flows with role-aware defaults and local store add-on.
interface Props {
  source: StoreSelectorSource;
  onSelect: (store: {
    department: string;
    representative: string;
    store: string;
  }) => void;
  onBack?: () => void;
}

function normalizeText(value: string): string {
  return value
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('uk-UA');
}

function matchesProfileValue(profileValue: string, candidate: string): boolean {
  const normalizedProfile = normalizeText(profileValue);
  const normalizedCandidate = normalizeText(candidate);
  return normalizedProfile === normalizedCandidate;
}

export default function StoreSelector({ source, onSelect, onBack }: Props) {
  const authEmail = getCurrentAuthorizedEmail();
  const userRole = getUserRole(authEmail);
  const profileRepresentative = getUserRepresentative(authEmail) ?? '';
  const isAgent = userRole === 'agent';
  const showDepartment = !isAgent && userRole !== 'supervisor';
  const [department, setDepartment] = useState('');
  const [representative, setRepresentative] = useState('');
  const [store, setStore] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [localStores, setLocalStores] = useState<string[]>([]);
  const [popupMessage, setPopupMessage] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.storeSelectorData(source),
    queryFn: () => fetchStoreSelectorData(source),
  });

  const normalizedData = useMemo<StoreSelectorRow[]>(() => {
    if (!Array.isArray(data)) {
      return [];
    }

    return data.filter(
      item =>
        item &&
        typeof item.department === 'string' &&
        typeof item.representative === 'string' &&
        typeof item.store === 'string'
    );
  }, [data]);

  const departments = useMemo(() => {
    return [...new Set(normalizedData.map(item => item.department))].sort(
      (a, b) => a.localeCompare(b, 'uk')
    );
  }, [normalizedData]);

  const departmentRows = useMemo(() => {
    if (!showDepartment) return normalizedData;
    return normalizedData.filter(item => item.department === department);
  }, [department, normalizedData, showDepartment]);

  const representatives = useMemo(() => {
    return [...new Set(departmentRows.map(item => item.representative))].sort(
      (a, b) => a.localeCompare(b, 'uk')
    );
  }, [departmentRows]);

  const effectiveRepresentative = isAgent
    ? representatives.find(item => matchesProfileValue(profileRepresentative, item)) ?? ''
    : representative;
  const representativeRows = useMemo(
    () => departmentRows.filter(item => item.representative === effectiveRepresentative),
    [departmentRows, effectiveRepresentative]
  );
  const effectiveDepartment = showDepartment
    ? department
    : (representativeRows.find(item => item.store === store) ?? representativeRows[0])?.department ?? '';
  const stores = useMemo(() => {
    if (!effectiveRepresentative) return [];
    const fromSheet = representativeRows.map(item => item.store);
    return [...new Set([...fromSheet, ...localStores])].sort((a, b) =>
      a.localeCompare(b, 'uk')
    );
  }, [effectiveRepresentative, representativeRows, localStores]);

  function handleDepartmentChange(value: string) {
    setDepartment(value);
    setRepresentative('');
    setStore('');
    setLocalStores([]);
  }

  function handleRepresentativeChange(value: string) {
    setRepresentative(value);
    setStore('');
    setLocalStores([]);
  }

  function handleConfirm() {
    if (!effectiveDepartment || !effectiveRepresentative || !store) {
      setPopupMessage('Оберіть всі поля');
      return;
    }

    onSelect({
      department: effectiveDepartment,
      representative: effectiveRepresentative,
      store,
    });
  }

  function handleAddLocalStore() {
    const nextStore = newStoreName.trim();

    if (!effectiveDepartment || !effectiveRepresentative) {
      setPopupMessage('Спочатку оберіть відділ і торгового представника.');
      return;
    }

    if (!nextStore) {
      setPopupMessage('Вкажіть назву торгової точки.');
      return;
    }

    setLocalStores(prev =>
      prev.includes(nextStore) ? prev : [...prev, nextStore]
    );
    setStore(nextStore);
    setNewStoreName('');
  }

  if (isLoading) {
    return <div className={styles.wrapper}>{onBack && <BackButton onBack={onBack} />}<Loader /></div>;
  }

  if (isError) {
    return (
      <div className={styles.wrapper}>
        <p>Не вдалося завантажити список торгових точок.</p>
        {onBack && (
          <button className={styles.backButton} onClick={onBack}>
            ← Головна сторінка
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {onBack && <BackButton onBack={onBack} />}
      {showDepartment && (
        <select
            className={styles.select}
            value={department}
            onChange={e => handleDepartmentChange(e.target.value)}
          >
            <option value="" disabled hidden>
              Відділ
            </option>

            {departments.map(item => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
      )}
      {!isAgent && (
        <select
            className={styles.select}
            value={representative}
            disabled={showDepartment && !department}
            onChange={e => handleRepresentativeChange(e.target.value)}
          >
            <option value="" disabled hidden>
              Торговий представник
            </option>

            {representatives.map(item => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
      )}

      <select
        className={styles.select}
        value={store}
        disabled={!effectiveRepresentative}
        onChange={e => setStore(e.target.value)}
      >
        <option value="" disabled hidden>
          Торгова точка
        </option>

        {stores.map(item => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <button
        className={styles.newStoreButton}
        onClick={handleAddLocalStore}
        disabled={!effectiveDepartment || !effectiveRepresentative}
      >
        ➕ Додати торгову точку локально
      </button>

      <input
        className={styles.select}
        value={newStoreName}
        onChange={e => setNewStoreName(e.target.value)}
        placeholder="Назва нової торгової точки"
        disabled={!effectiveDepartment || !effectiveRepresentative}
      />

      <button className={styles.confirmButton} onClick={handleConfirm}>
        Далі
      </button>

      {onBack && (
        <button className={styles.backButton} onClick={onBack}>
          ← Головна сторінка
        </button>
      )}

      {popupMessage && (
        <Popup message={popupMessage} onClose={() => setPopupMessage(null)} />
      )}
    </div>
  );
}
