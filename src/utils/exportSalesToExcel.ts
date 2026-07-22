import * as XLSX from 'xlsx';
import type { Sale } from '../api/fetchSales';

type BrandRow = {
  brand: string;
  amount: number;
  weight: number;
  stores: number;
};

type TotalRow = {
  amount: number;
  weight: number;
  stores: number;
};

type ExportParams = {
  sales: Sale[];
  brandsList: BrandRow[];
  totalRow: TotalRow;
  agent: string | string[];
  dateFrom: string;
  dateTo: string;
  isMobile: boolean;
};

export const exportSalesToExcel = async ({
  sales,
  brandsList,
  totalRow,
  agent,
  dateFrom,
  dateTo,
  isMobile,
}: ExportParams) => {
  const rows = sales.map(s => ({
    Дата: s.дата,
    Місяць: s.місяць,
    Відділ: s.відділ,
    Агент: s.агент,
    ТТ: s.торгова_точка,
    Бренд: s.бренд,
    Товар: s.товар,
    Кількість: s.кількість,
    Вага: s.вага,
    Сума: s.сума,
  }));

  const renderRows: Array<Record<string, string | number>> = [];

  brandsList.forEach(b => {
    renderRows.push({
      Блок: 'Зведення ТМ',
      Назва: b.brand,
      ТТ: b.stores,
      Вага: b.weight,
      Сума: b.amount,
    });
  });

  renderRows.push({
    Блок: 'Зведення ТМ',
    Назва: 'Усі торгові марки',
    ТТ: totalRow.stores,
    Вага: totalRow.weight,
    Сума: totalRow.amount,
  });

  const summaryRows = brandsList.map(b => ({
    Бренд: b.brand,
    ТТ: b.stores,
    Вага: b.weight,
    Сума: b.amount,
  }));

  summaryRows.push({
    Бренд: 'Усі торгові марки',
    ТТ: totalRow.stores,
    Вага: totalRow.weight,
    Сума: totalRow.amount,
  });

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(summaryRows),
    'Зведення'
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(renderRows),
    'Рендер'
  );

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Деталі');

  const fromPart = dateFrom || 'початок';
  const toPart = dateTo || 'кінець';
  const agentPart = Array.isArray(agent) ? agent.join('_') : agent;

  const fileName = `продажі_${agentPart || 'усі'}_${fromPart}_${toPart}.xlsx`;

  if (isMobile && typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      const fileBuffer = XLSX.write(wb, {
        bookType: 'xlsx',
        type: 'array',
      });

      const file = new File([fileBuffer], fileName, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const canShareWithFiles =
        'canShare' in navigator &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });

      if (canShareWithFiles) {
        await navigator.share({
          title: 'Продажі',
          files: [file],
        });

        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
    }
  }

  XLSX.writeFile(wb, fileName);
};
