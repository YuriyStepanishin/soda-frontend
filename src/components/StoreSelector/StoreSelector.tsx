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
import {
  getCurrentAuthorizedEmail,
  getUserDepartment,
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
  const profileDepartment = getUserDepartment(authEmail) ?? '';
  const profileRepresentative = getUserRepresentative(authEmail) ?? '';
  const isAgent = userRole === 'agent';
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

  const profileDepartmentCandidates = useMemo(() => {
    return profileDepartment
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
  }, [profileDepartment]);

  const effectiveDepartment = useMemo(() => {
    if (!isAgent) {
      return department;
    }

    if (department) {
      return department;
    }

    const matchedDepartment = departments.find(item =>
      profileDepartmentCandidates.some(candidate =>
        matchesProfileValue(candidate, item)
      )
    );

    if (matchedDepartment) {
      return matchedDepartment;
    }

    if (departments.length === 1) {
      return departments[0];
    }

    return '';
  }, [isAgent, department, departments, profileDepartmentCandidates]);

  const departmentRows = useMemo(() => {
    if (!effectiveDepartment) {
      return [];
    }

    return normalizedData.filter(
      item => item.department === effectiveDepartment
    );
  }, [normalizedData, effectiveDepartment]);

  const representatives = useMemo(() => {
    return [...new Set(departmentRows.map(item => item.representative))].sort(
      (a, b) => a.localeCompare(b, 'uk')
    );
  }, [departmentRows]);

  const effectiveRepresentative = useMemo(() => {
    if (!isAgent) {
      return representative;
    }

    if (representative) {
      return representative;
    }

    const matchedRepresentative = representatives.find(item =>
      matchesProfileValue(profileRepresentative, item)
    );

    if (matchedRepresentative) {
      return matchedRepresentative;
    }

    if (representatives.length === 1) {
      return representatives[0];
    }

    return '';
  }, [isAgent, representative, representatives, profileRepresentative]);

  const stores = useMemo(() => {
    if (!effectiveDepartment || !effectiveRepresentative) {
      return [];
    }

    const fromSheet = departmentRows
      .filter(item => item.representative === effectiveRepresentative)
      .map(item => item.store);

    return [...new Set([...fromSheet, ...localStores])].sort((a, b) =>
      a.localeCompare(b, 'uk')
    );
  }, [
    effectiveDepartment,
    effectiveRepresentative,
    departmentRows,
    localStores,
  ]);

  function handleDepartmentChange(value: string) {
    setDepartment(value);
    setRepresentative('');
    setStore('');
  }

  function handleRepresentativeChange(value: string) {
    setRepresentative(value);
    setStore('');
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
    return <Loader />;
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
      {isAgent ? (
        <>
          <div className={styles.lockedField}>
            <span className={styles.lockedLabel}>Відділ</span>
            <div className={styles.lockedValue}>
              {effectiveDepartment || '—'}
            </div>
          </div>
          <div className={styles.lockedField}>
            <span className={styles.lockedLabel}>Торговий представник</span>
            <div className={styles.lockedValue}>
              {effectiveRepresentative || '—'}
            </div>
          </div>
        </>
      ) : (
        <>
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

          <select
            className={styles.select}
            value={representative}
            disabled={!effectiveDepartment}
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
        </>
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
