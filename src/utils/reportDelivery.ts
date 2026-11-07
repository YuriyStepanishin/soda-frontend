export function isMobileOrTablet(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (/Mac/i.test(navigator.platform) && navigator.maxTouchPoints > 1);
}

export type PreparedReportFile = { blob: Blob; fileName: string; title: string };
export type ReportSharingStatus = 'shared' | 'cancelled' | 'unsupported' | 'retry';

export function savePreparedReport(report: PreparedReportFile): void {
  const url = URL.createObjectURL(report.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = report.fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  try { link.click(); } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function sharePreparedReport(report: PreparedReportFile): Promise<ReportSharingStatus> {
  if (typeof navigator === 'undefined' || typeof File === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return 'unsupported';
  const file = new File([report.blob], report.fileName, { type: report.blob.type });
  try {
    if (!navigator.canShare({ files: [file] })) return 'unsupported';
    await navigator.share({ title: report.title, files: [file] });
    return 'shared';
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'retry';
  }
}

export function reportDeliveryMessage(status: 'saved' | ReportSharingStatus): string {
  switch (status) {
    case 'saved': return 'Завантаження Excel-файла розпочато.';
    case 'shared': return 'Завантаження файла розпочато; файл передано системі для відправлення.';
    case 'cancelled': return 'Відправлення не виконано. Завантаження Excel-файла розпочато.';
    case 'unsupported': return 'Завантаження файла розпочато. Цей браузер не підтримує відправлення Excel у програми — відкрийте файл у «Завантаженнях» і натисніть «Поділитися».';
    case 'retry': return 'Завантаження файла розпочато. Натисніть «Вибрати програму», щоб відкрити системне меню відправлення.';
  }
}
