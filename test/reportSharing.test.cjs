const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { File, Blob } = require('node:buffer');
const code = ts.transpileModule(fs.readFileSync(require.resolve('../src/utils/reportDelivery.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function delivery(navigator) {
  const exported = {};
  new Function('navigator', 'File', 'DOMException', 'exports', code)(navigator, File, DOMException, exported);
  return exported;
}
const report = { blob: new Blob(['report'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName: 'report.xlsx', title: 'Звіт' };

test('native share is invoked immediately using the prepared Excel file', async () => {
  let invoked = false;
  const api = delivery({ canShare: () => true, share(payload) {
    invoked = true;
    assert.equal(payload.files[0].name, 'report.xlsx');
    return Promise.resolve();
  } });
  const result = api.sharePreparedReport(report);
  assert.ok(invoked);
  assert.equal(await result, 'shared');
});

test('cancel and unsupported file sharing do not pretend that a file was sent', async () => {
  const cancelled = delivery({ canShare: () => true, share: () => Promise.reject(new DOMException('Cancelled', 'AbortError')) });
  assert.equal(await cancelled.sharePreparedReport(report), 'cancelled');
  assert.equal(await delivery({}).sharePreparedReport(report), 'unsupported');
  assert.equal(await delivery({ canShare: () => false, share() { assert.fail(); } }).sharePreparedReport(report), 'unsupported');
  assert.ok(!cancelled.reportDeliveryMessage('retry').includes('Вибрати програму'));
});
