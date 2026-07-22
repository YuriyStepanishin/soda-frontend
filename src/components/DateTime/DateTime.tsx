import { useEffect, useMemo, useState } from 'react';
import styles from './DateTime.module.css';

export default function DateTime() {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const quotes = useMemo(
    () => [
      '«Люди не купують товари. Вони купують послуги, історії, магію та рішення своїх проблем».',
      '«Не відкладайте на завтра те, що можна зробити сьогодні» (Народна мудрість)',
    ],
    []
  );

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  const kyivWeekdayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('uk-UA', {
        timeZone: 'Europe/Kyiv',
        weekday: 'long',
      }),
    []
  );

  const kyivDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('uk-UA', {
        timeZone: 'Europe/Kyiv',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
    []
  );

  const kyivTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('uk-UA', {
        timeZone: 'Europe/Kyiv',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }),
    []
  );

  const kyivWeekday = kyivWeekdayFormatter
    .format(currentTime)
    .replace(/^./, letter => letter.toUpperCase());
  const kyivDate = kyivDateFormatter.format(currentTime);
  const kyivTime = kyivTimeFormatter.format(currentTime);

  return (
    <div className={styles.kyivDateTime} aria-live="polite" aria-atomic="true">
      <div className={styles.kyivHeader}>
        <span className={styles.uaFlag} aria-hidden="true" />
        <span className={styles.kyivDateTimeLabel}>Хмельницький</span>
      </div>
      <strong className={styles.kyivDateTimeValue}>{kyivTime}</strong>
      <span className={styles.kyivDateTimeSub}>
        {kyivWeekday}, {kyivDate}
      </span>
      <div className={styles.kyivQuote}>
        {quotes.map(quote => (
          <p key={quote} className={styles.kyivQuoteLine}>
            {quote}
          </p>
        ))}
      </div>
    </div>
  );
}
