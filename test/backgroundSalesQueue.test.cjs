const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const exported = {};
const code = ts.transpileModule(fs.readFileSync(require.resolve('../src/utils/backgroundSalesQueue.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('exports', code)(exported);
const { refreshSalesQueue } = exported;
function fixture() {
  const reads = [];
  const args = {
    requests: [{ url: 'old', savedAt: 0 }, { url: 'fresh', savedAt: 9999999 }],
    read: async url => { reads.push(url); },
    signal: new AbortController().signal,
    isCurrent: () => true,
    yieldToForeground: async () => {},
    now: () => 10000000,
  };
  return { args, reads };
}
test('background refresh is sequential, skips fresh copies and requires no user action', async () => {
  const { args, reads } = fixture();
  let active = 0;
  args.requests.push({ url: 'next', savedAt: 0 });
  args.read = async url => { assert.equal(active++, 0); await Promise.resolve(); reads.push(url); active--; };
  await refreshSalesQueue(args);
  assert.deepEqual(reads, ['old', 'next']);
});
test('logout, tenant switch or hiding the app while yielding prevents the next read', async () => {
  const { args, reads } = fixture();
  let current = true;
  args.isCurrent = () => current;
  args.yieldToForeground = async () => { current = false; };
  await refreshSalesQueue(args);
  assert.deepEqual(reads, []);
});
test('aborted or offline background jobs do not fetch; an error stops the queue silently', async () => {
  const { args, reads } = fixture();
  const abort = new AbortController();
  abort.abort();
  await refreshSalesQueue({ ...args, signal: abort.signal });
  await refreshSalesQueue({ ...args, isCurrent: () => false });
  assert.deepEqual(reads, []);
  let attempts = 0;
  await refreshSalesQueue({ ...args, requests: [{ url: 'a', savedAt: 0 }, { url: 'b', savedAt: 0 }], read: async () => { attempts++; throw Error('network unavailable'); } });
  assert.equal(attempts, 1);
});
const historyExports = {};
new Function('exports', ts.transpileModule(fs.readFileSync(require.resolve('../src/utils/historyOfflineRequests.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(historyExports);
test('all store cards are scheduled without opening them, preserving period and access filters', () => {
  const list = new URL('https://soda.test/api/sales/route-history?period=4months&asOfDate=2026-11-09&ta=agent&department=region&view=stores&groupingFields=group');
  const urls = historyExports.historyDetailRequests(list.toString(), [{ code: 'TT1' }, { code: 'TT2' }]);
  assert.equal(urls.length, 2);
  for (const [index, value] of urls.entries()) {
    const url = new URL(value);
    assert.equal(url.searchParams.get('storeCode'), `TT${index + 1}`);
    assert.equal(url.searchParams.get('view'), 'details');
    for (const key of ['period', 'asOfDate', 'ta', 'department']) assert.equal(url.searchParams.get(key), list.searchParams.get(key));
    assert.equal(url.searchParams.get('groupingFields'), 'group,subgroup,tm,packing');
  }
});
