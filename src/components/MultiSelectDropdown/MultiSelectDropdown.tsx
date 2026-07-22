import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './MultiSelectDropdown.module.css';

interface MultiSelectDropdownProps {
  label: string;
  items: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
}

export default function MultiSelectDropdown({
  label,
  items,
  selected,
  onChange,
  searchable = false,
}: MultiSelectDropdownProps) {
  console.log('🔄 Render:', label);

  useEffect(() => {
    console.log('✅ Mounted:', label);

    return () => {
      console.log('❌ Unmounted:', label);
    };
  }, [label]);

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    console.log('📂 Open:', label, open);
  }, [open, label]);

  useEffect(() => {
    console.log(label, 'selected =', selected, 'length =', selected.length);
  }, [label, selected]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchable || !search.trim()) return items;

    return items.filter(item =>
      item.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search, searchable]);

  const selectedText = useMemo(() => {
    if (selected.length === 0) return 'Усі';
    if (selected.length <= 2) return selected.join(', ');

    return `${selected.slice(0, 2).join(', ')} +${selected.length - 2}`;
  }, [selected]);

  const visibleSelectedItems = useMemo(() => selected.slice(0, 3), [selected]);
  const hiddenSelectedCount = Math.max(
    0,
    selected.length - visibleSelectedItems.length
  );

  const toggleItem = (item: string) => {
    console.log('🖱 Click:', item);

    if (selected.includes(item)) {
      onChange(selected.filter(v => v !== item));
    } else {
      onChange([...selected, item]);
    }
  };

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <label className={styles.label}>{label}</label>

      <div
        className={styles.header}
        title={selected.join(', ')}
        onClick={() => {
          console.log('📂 Toggle dropdown');
          setOpen(prev => {
            const next = !prev;

            if (!next) {
              setSearch('');
            }

            return next;
          });
        }}
      >
        <span className={styles.headerLabel}>{label}</span>
        <span className={styles.headerValue}>
          {selected.length === 0 ? (
            <span className={styles.headerPlaceholder}>{selectedText}</span>
          ) : (
            <span className={styles.chipRow}>
              {visibleSelectedItems.map(item => (
                <span key={item} className={styles.chip} title={item}>
                  <span className={styles.chipText}>{item}</span>
                </span>
              ))}
              {hiddenSelectedCount > 0 && (
                <span className={styles.chipMore}>+{hiddenSelectedCount}</span>
              )}
            </span>
          )}
          <span className={styles.headerArrow}>▼</span>
        </span>
      </div>

      {open && (
        <div className={styles.dropdown} onClick={e => e.stopPropagation()}>
          {searchable && (
            <input
              className={styles.search}
              type="text"
              placeholder="Пошук..."
              value={search}
              autoFocus
              onChange={e => setSearch(e.target.value)}
            />
          )}

          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => {
                console.log('✔ Select all');
                onChange(filteredItems);
              }}
            >
              Всі
            </button>

            <button
              type="button"
              onClick={() => {
                console.log('🗑 Clear');
                onChange([]);
              }}
            >
              Очистити
            </button>
          </div>

          <div className={styles.list}>
            {filteredItems.map(item => (
              <label key={item} className={styles.option}>
                <input
                  type="checkbox"
                  checked={selected.includes(item)}
                  onChange={() => toggleItem(item)}
                />

                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
