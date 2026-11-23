import type { ReactNode } from 'react';
import Modal from './Modal';
import styles from './AppDialog.module.css';

type Props = {
  title: string;
  message: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
};

/** Shared, accessible SODA dialog. No native window.alert/window.confirm. */
export default function AppDialog({
  title, message, onClose, onConfirm, confirmLabel = 'Підтвердити',
  cancelLabel = 'Скасувати', destructive = false, busy = false,
}: Props) {
  return <Modal title={title} onClose={() => { if (!busy) onClose(); }}>
    <div className={styles.content} role={onConfirm ? 'alertdialog' : 'status'}>
      <div className={styles.message}>{message}</div>
      <div className={styles.actions}>
        {onConfirm && <button type="button" onClick={onClose} disabled={busy}>{cancelLabel}</button>}
        <button type="button" className={destructive ? styles.danger : styles.primary}
          disabled={busy} onClick={onConfirm ?? onClose}>
          {busy ? 'Виконуємо…' : onConfirm ? confirmLabel : 'Зрозуміло'}
        </button>
      </div>
    </div>
  </Modal>;
}
