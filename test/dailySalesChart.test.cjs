const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const exported = {};
const code = ts.transpileModule(fs.readFileSync(require.resolve('../src/utils/dailySalesChart.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('exports', code)(exported);
const { dailyChartPoints, dailyChartDomain } = exported;
const row = (date, amount, week_year = 2026, week_number = 45) => ({ date, amount, week_year, week_number, storesCount: 2, weight: 5 });

test('daily timeline sorts dates, preserves returns and does not invent missing days', () => {
  const source = [row('2026-11-04', -20), row('2026-11-02', 100)];
  const result = dailyChartPoints(source, 'amount', 'day');
  assert.deepEqual(result.map(point => [point.date, point.value]), [['2026-11-02', 100], ['2026-11-04', -20]]);
  assert.equal(source[0].date, '2026-11-04');
  assert.deepEqual(dailyChartDomain(result), { min: -20, max: 100 });
});

test('weekly grouping uses ISO week year and sums daily metrics without claiming unique outlets', () => {
  const source = [row('2026-12-28', 10, 2026, 53), row('2027-01-01', -3, 2026, 53), row('2027-01-04', 20, 2027, 1)];
  const result = dailyChartPoints(source, 'amount', 'week');
  assert.deepEqual(result.map(point => [point.label, point.value]), [['Тиждень 53 / 2026', 7], ['Тиждень 1 / 2027', 20]]);
  assert.equal(dailyChartPoints(source, 'storesCount', 'week')[0].value, 4);
  assert.equal(dailyChartPoints(source, 'weight', 'week')[0].value, 10);
});

test('zero, empty and negative-only timelines have a valid domain with a zero baseline', () => {
  assert.deepEqual(dailyChartPoints([], 'amount', 'day'), []);
  assert.deepEqual(dailyChartDomain([]), { min: 0, max: 1 });
  assert.deepEqual(dailyChartDomain(dailyChartPoints([row('2026-11-01', 0)], 'amount', 'day')), { min: 0, max: 1 });
  assert.deepEqual(dailyChartDomain(dailyChartPoints([row('2026-11-01', -30)], 'amount', 'day')), { min: -30, max: 0 });
  assert.deepEqual(dailyChartPoints([row('2026-11-01', NaN)], 'amount', 'day'), []);
});
