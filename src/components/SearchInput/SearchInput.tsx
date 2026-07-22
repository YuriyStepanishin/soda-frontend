import { type ChangeEvent } from 'react';
import styles from './SearchInput.module.css';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Пошук…',
  label,
  className,
  autoFocus = false,
  ariaLabel = 'Поле пошуку',
}: SearchInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className={`${styles.searchInput} ${className ?? ''}`.trim()}>
      {label ? (
        <label className={styles.label}>
          {label}
          <span className={styles.srOnly}>{ariaLabel}</span>
        </label>
      ) : null}

      <div className={styles.inputWrapper}>
        <span className={styles.icon} aria-hidden="true">
          🔎
        </span>

        <input
          type="search"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoFocus={autoFocus}
          className={styles.input}
        />
      </div>
    </div>
  );
}
