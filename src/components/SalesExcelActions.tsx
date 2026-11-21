import { useState } from 'react';
import { reportDeliveryMessage, savePreparedReport, sharePreparedReport } from '../utils/reportDelivery';
import type { PreparedReportFile } from '../utils/reportDelivery';

export default function SalesExcelActions({ file, preparing }: {
  file: PreparedReportFile | null;
  preparing: boolean;
}) {
  const [sharing, setSharing] = useState(false);
  const [feedback, setFeedback] = useState<{ file: PreparedReportFile; text: string; error?: boolean } | null>(null);

  function save() {
    if (!file) return;
    try {
      savePreparedReport(file);
      setFeedback({ file, text: reportDeliveryMessage('saved') });
    } catch {
      setFeedback({ file, text: 'Не вдалося зберегти Excel.', error: true });
    }
  }

  async function share() {
    if (!file || sharing) return;
    setSharing(true);
    setFeedback(null);
    try {
      const result = await sharePreparedReport(file);
      setFeedback({ file, text: reportDeliveryMessage(result, false) });
    } catch {
      setFeedback({ file, text: reportDeliveryMessage('retry', false), error: true });
    } finally {
      setSharing(false);
    }
  }

  return <>
    <button type="button" disabled={!file || sharing} onClick={save}>Зберегти Excel</button>
    <button type="button" disabled={!file || sharing} onClick={() => void share()}>
      {sharing ? 'Відправлення…' : 'Відправити Excel'}
    </button>
    {preparing && <span role="status">Підготовка Excel…</span>}
    {feedback && feedback.file === file && <span role={feedback.error ? 'alert' : 'status'}>{feedback.text}</span>}
  </>;
}
