import type { PreparedReportFile } from '../../utils/reportDelivery';

export type PriceRow = {
  row: number;
  name: string;
  unit: string;
  purchase?: number | null;
  base: number | null;
  route: string[];
};

export type PriceMode = 'markup' | 'discount';
type PriceHeading = { key: string; name: string; depth: number };

const archivedSection = /(?:^|[^\p{L}])(?:я*стар(?:ий|а|е|і|их|ого|ої|ими|ому|им|у|ою)|архів(?:ні|ний|на|не)?)(?=$|[^\p{L}])/iu;
export const sectionKey = (route: string[]) => JSON.stringify(route);
export const sectionOrder = new Intl.Collator('uk-UA', { numeric: true });

export function activePriceRows(rows: PriceRow[]) {
  return rows.filter(row => !row.route.some(section => archivedSection.test(section)));
}

export function sortPriceRows(rows: PriceRow[]) {
  return [...rows].sort((a, b) => {
    for (let index = 0; index < Math.min(a.route.length, b.route.length); index++) {
      const order = sectionOrder.compare(a.route[index], b.route[index]);
      if (order) return order;
      if (a.route[index] !== b.route[index]) return a.route[index] < b.route[index] ? -1 : 1;
    }
    return a.route.length - b.route.length;
  });
}

export function withPriceHeadings(rows: PriceRow[]) {
  let previous: string[] = [];
  return rows.map(row => {
    let common = 0;
    while (common < row.route.length && previous[common] === row.route[common]) common++;
    const headings: PriceHeading[] = row.route.slice(common).map((name, index) => {
      const depth = common + index;
      return { key: sectionKey(row.route.slice(0, depth + 1)), name, depth };
    });
    previous = row.route;
    return { headings, row };
  });
}

export function calculatedPrice(row: PriceRow, mode: PriceMode, rate: number | null) {
  const source = mode === 'markup' ? (row.purchase ?? null) : row.base;
  if (source === null || rate === null) return null;
  const adjusted = source * (1 + (mode === 'markup' ? rate : -rate) / 100);
  if (!Number.isFinite(adjusted * 100)) return null;
  return Math.round((adjusted + Number.EPSILON * Math.max(1, adjusted)) * 100) / 100;
}

export async function preparePriceFile(
  rows: PriceRow[], date: string, mode: PriceMode, rate: number,
): Promise<PreparedReportFile> {
  const lines = withPriceHeadings(rows).map(({ headings, row }) => {
    const price = calculatedPrice(row, mode, rate);
    if (mode === 'markup' && price !== null && price === row.purchase) {
      throw new Error('Для Excel потрібна відпускна ціна. Збільште націнку або виберіть знижку від базової ціни.');
    }
    return { headings, name: row.name, unit: row.unit, price };
  });

  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Прайс', { views: [{ state: 'frozen', ySplit: 2 }] });
  const title = 'Прайс LASKA від ' + date;
  sheet.columns = [{ width: 66 }, { width: 12 }, { width: 22 }];
  sheet.mergeCells('A1:C1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14 };
  sheet.addRow(['Назва', 'Одиниця', 'Розрахункова ціна']).font = { bold: true };
  for (const line of lines) {
    for (const heading of line.headings) {
      const header = sheet.addRow([heading.name]);
      sheet.mergeCells(header.number, 1, header.number, 3);
      const cell = header.getCell(1);
      cell.font = { bold: true };
      cell.alignment = { indent: heading.depth };
      cell.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: heading.depth === 0 ? 'FFDCE8F5' : 'FFEDF3FA' },
      };
    }
    const product = sheet.addRow([line.name, line.unit, line.price]);
    product.getCell(3).numFmt = '#,##0.00';
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  return { blob, fileName: title + '.xlsx', title };
}
