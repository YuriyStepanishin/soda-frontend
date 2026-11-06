const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
// Transpile source with the project's own TypeScript compiler; no test-only runtime dependency.
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { meanPerformance, debtStatus, shiftMonths, periods, selectRows, buildReport } = require('../src/components/MotivationPage/motivation.utils.ts');
const data = () => ({ agents: [{ id: '1', name: 'ТА' }], records: [], budget: 15000, buffer: 7 });
const record = (patch = {}) => ({ id: '1', agent: '1', date: '2026-11-05', route: 'Маршрут', direction: 'АКБ', actual: 8, target: 10, status: 'підтверджено', evidence: 'Звіт', owner: 'Менеджер', issue: '', recheck: '', invoiceDate: '2026-10-15', term: 14, balance: 100, ...patch });
const filters = { months: 3, end: '2026-11-05', agent: '', route: '' };
test('unknown is not zero; problematic or unverified facts never enter performance', () => {
  assert.equal(meanPerformance([]), null);
  assert.equal(meanPerformance([record({ status: 'не перевірено', actual: 0 })]), null);
  assert.equal(meanPerformance([record(), record({ status: 'проблема', actual: 0 })]), 80);
  assert.equal(meanPerformance([record({ actual: 0 })]), 0);
  assert.equal(meanPerformance([record({ actual: 20 })]), 100);
});
test('individual payment term plus seven-day buffer: boundary, next day, overpayment, missing source fields', () => {
  assert.equal(debtStatus(record(), 7, '2026-11-05').critical, false);
  assert.equal(debtStatus(record(), 7, '2026-11-06').critical, true);
  assert.equal(debtStatus(record({ term: 30 }), 7, '2026-11-06').critical, false);
  assert.equal(debtStatus(record({ balance: 0 }), 7, '2026-12-31').critical, false);
  assert.equal(debtStatus(record({ balance: -100 }), 7, '2026-12-31').critical, false);
  assert.equal(debtStatus(record({ balance: '' }), 7, '2026-12-31').label, 'Недостатньо даних про борг');
});
test('calendar month shifts clamp end of month and comparable periods do not overlap', () => {
  assert.equal(shiftMonths('2026-03-31', -1), '2026-02-28');
  const range = periods(filters); assert.equal(range.start, '2026-08-06'); assert.equal(range.previousEnd, '2026-08-05');
  const state = data(); state.records = [record({ date: range.start }), record({ id: '2', date: range.previousEnd }), record({ id: '3', agent: '2' })];
  assert.equal(selectRows(state, { ...filters, agent: '1' }).length, 1); assert.equal(selectRows(state, filters, true).length, 1);
});
test('empty report explicitly states missing evidence and includes three next steps', () => {
  const report = buildReport(data(), filters);
  assert.match(report, /АКБ: немає підтверджених даних/); assert.match(report, /3\. Зіставити/); assert.doesNotMatch(report, /АКБ: 0%/);
});
