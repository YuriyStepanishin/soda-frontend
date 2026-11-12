import { usePageBack } from '../Navigation/useNavigationBack';
import styles from './BackButton.module.css';

export default function BackButton({ onBack, label = 'До головної' }: {
  onBack: () => void;
  label?: string;
}) {
  const managed = usePageBack(onBack, label === 'До головної' ? 'Назад' : label);
  if (managed) return null;
  return <button type="button" className={styles.button} onClick={onBack}>← {label}</button>;
}
