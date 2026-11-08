import styles from './BackButton.module.css';

export default function BackButton({ onBack, label = 'До головної' }: {
  onBack: () => void;
  label?: string;
}) {
  return <button type="button" className={styles.button} onClick={onBack}>← {label}</button>;
}
