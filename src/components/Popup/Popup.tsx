import styles from './Popup.module.css';

type Props = {
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
};

export default function Popup({
  message,
  onClose,
  onConfirm,
  confirmLabel = 'OK',
  cancelLabel = 'Скасувати',
}: Props) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.popup}>
        <div className={styles.message}>{message}</div>
        {onConfirm ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.button} ${styles.secondaryButton}`}
              onClick={onClose}
            >
              {cancelLabel}
            </button>
            <button type="button" className={styles.button} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        ) : (
          <button type="button" className={styles.button} onClick={onClose}>
            {confirmLabel}
          </button>
        )}
      </div>
    </div>
  );
}
