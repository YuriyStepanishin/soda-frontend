import { savePreparedReport, sharePreparedReport } from './reportDelivery';
import type { PreparedReportFile, ReportSharingStatus } from './reportDelivery';

export type ReportMetric = 'quantity' | 'stores' | 'weight' | 'amount' | 'sku';
export type ReportExportRow = {
  label: string;
  level?: number;
} & Partial<Record<ReportMetric, number | null>>;

export type ResultsExportParams = {
  rows: ReportExportRow[];
  totals: ReportExportRow;
  metrics: Record<ReportMetric, boolean>;
  title: string;
  reportMeta?: string[];
  tenant: string | null;
  dateFrom: string;
  dateTo: string;
  shareWithApps: boolean;
  signal?: AbortSignal;
};

const metricColumns: Array<{
  key: ReportMetric;
  label: string;
  format: string;
}> = [
  { key: 'stores', label: 'АКБ', format: '#,##0;[Red](#,##0);0' },
  {
    key: 'quantity',
    label: 'Кількість',
    format: '#,##0.###;[Red](#,##0.###);0',
  },
  { key: 'weight', label: 'Вага', format: '#,##0.###;[Red](#,##0.###);0' },
  { key: 'sku', label: 'SKU', format: '#,##0;[Red](#,##0);0' },
  { key: 'amount', label: 'Сума', format: '#,##0.00;[Red](#,##0.00);0.00' },
];

export async function buildResultsWorkbook(params: ResultsExportParams) {
  params.signal?.throwIfAborted();
  const { default: ExcelJS } = await import('exceljs');
  params.signal?.throwIfAborted();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SODA';
  const sheet = workbook.addWorksheet('Результати', {
    properties: {
      tabColor: { argb: 'FF17365D' },
      outlineProperties: { summaryBelow: false, summaryRight: false },
    },
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      // ExcelJS 4.4 writes pageSetUpPr before outlinePr, which Excel rejects.
      // Use normal print scaling so outline grouping stays valid (issue #1348).
      fitToPage: false,
      scale: 100,
    },
  });
  const columns = metricColumns.filter(column => params.metrics[column.key]);
  const maxLevel = params.rows.reduce(
    (maximum, row) => Math.max(maximum, row.level ?? 0),
    0
  );
  const columnCount = columns.length + 1;
  sheet.getColumn(1).width = 64;
  columns.forEach((_, index) => {
    sheet.getColumn(index + 2).width = 18;
  });

  const addBanner = (
    text: string,
    color: string,
    textColor: string,
    height: number,
    size: number
  ) => {
    const row = sheet.addRow([text]);
    if (columnCount > 1)
      sheet.mergeCells(row.number, 1, row.number, columnCount);
    row.height = height;
    row.eachCell({ includeEmpty: true }, cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color },
      };
      cell.font = {
        name: 'Calibri',
        size,
        color: { argb: textColor },
        bold: size > 11,
      };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  };
  addBanner(params.title, 'FF17365D', 'FFFFFFFF', 34, 17);
  const period = `${params.dateFrom || 'початок'} — ${params.dateTo || 'кінець'}`;
  addBanner(
    `SODA · ${(params.tenant || '').toUpperCase()} · Період: ${period}`,
    'FFDCE6F1',
    'FF17365D',
    30,
    11
  );
  for (const line of params.reportMeta || []) {
    const charactersPerLine = 50 + columns.length * 15;
    for (
      let offset = 0;
      offset < line.length;
      offset += charactersPerLine * 3
    ) {
      const chunk = line.slice(offset, offset + charactersPerLine * 3);
      addBanner(
        chunk,
        'FFF3F6FA',
        'FF425466',
        Math.max(24, Math.ceil(chunk.length / charactersPerLine) * 16 + 8),
        10
      );
    }
  }

  const header = sheet.addRow([
    'Назва',
    ...columns.map(column => column.label),
  ]);
  header.height = 30;
  header.eachCell((cell, columnNumber) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF17365D' },
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: columnNumber === 1 ? 'left' : 'center',
      wrapText: true,
    };
  });

  const appendResult = (
    source: ReportExportRow,
    index: number,
    total: boolean
  ) => {
    const level = Math.max(0, source.level ?? 0);
    const parent = !total && level < maxLevel;
    const background = total
      ? 'FFE2F0D9'
      : parent
        ? level === 0
          ? 'FFDCE6F1'
          : 'FFE2EFDA'
        : index % 2
          ? 'FFF3F6FA'
          : 'FFFFFFFF';
    const foreground = total ? 'FF375623' : 'FF17365D';
    const row = sheet.addRow([
      total ? 'Разом' : source.label,
      ...columns.map(column => {
        const value = source[column.key];
        return typeof value === 'number' && Number.isFinite(value)
          ? value
          : null;
      }),
    ]);
    row.outlineLevel = total ? 0 : Math.min(level, 7);
    row.height = Math.max(
      24,
      Math.min(
        409,
        Math.ceil(source.label.length / Math.max(25, 60 - level * 4)) * 16
      )
    );
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: background },
      };
      cell.font = {
        name: 'Calibri',
        size: 11,
        bold: total || parent,
        color: { argb: foreground },
      };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFD9E2F3' } } };
      if (total)
        cell.border = { top: { style: 'medium', color: { argb: 'FF70AD47' } } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: columnNumber === 1 ? 'left' : 'right',
        wrapText: columnNumber === 1,
        indent: columnNumber === 1 && !total ? Math.min(level * 2, 14) : 0,
      };
      if (columnNumber > 1) cell.numFmt = columns[columnNumber - 2].format;
    });
  };
  params.rows.forEach((row, index) => appendResult(row, index, false));
  const lastResultRow = sheet.rowCount;
  appendResult(params.totals, params.rows.length, true);
  sheet.views = [
    { state: 'frozen', xSplit: 1, ySplit: header.number, showGridLines: false },
  ];
  sheet.autoFilter = {
    from: { row: header.number, column: 1 },
    to: { row: lastResultRow, column: columnCount },
  };
  sheet.pageSetup.printTitlesRow = `${header.number}:${header.number}`;
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(columnCount).letter}${sheet.rowCount}`;
  sheet.headerFooter.oddFooter = '&L SODA &R Сторінка &P з &N';
  return workbook;
}

export async function exportSalesToExcel(params: ResultsExportParams): Promise<{
  status: 'saved' | ReportSharingStatus;
  file: PreparedReportFile;
}> {
  const workbook = await buildResultsWorkbook(params);
  params.signal?.throwIfAborted();
  const buffer = await workbook.xlsx.writeBuffer();
  params.signal?.throwIfAborted();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safePart = (value: string) =>
    Array.from(value)
      .map(character => (character.charCodeAt(0) < 32 ? '_' : character))
      .join('')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 60);
  const fileName = `Звіт_${safePart(params.tenant || 'SODA')}_${safePart(params.dateFrom || 'початок')}_${safePart(params.dateTo || 'кінець')}.xlsx`;
  const file = { blob, fileName, title: params.title };
  params.signal?.throwIfAborted();
  savePreparedReport(file);
  return {
    file,
    status: params.shareWithApps ? await sharePreparedReport(file) : 'saved',
  };
}
