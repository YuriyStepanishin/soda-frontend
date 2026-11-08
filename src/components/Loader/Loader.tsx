import styles from './Loader.module.css';
export default function Loader({ inline = false, label = 'Завантаження…' }: {
  inline?: boolean;
  label?: string;
}) {
  return (
    <div className={inline ? styles.inline : styles.overlay} role="status" aria-live="polite">
      <div className={styles.loader} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
