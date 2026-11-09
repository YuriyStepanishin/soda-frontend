const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require('fake-indexeddb/auto');

function loader() {
  const modules = new Map();
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} };
    modules.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', code)(name => {
      if (name === './config') return { API_BASE_URL: 'https://soda.test', AUTH_TOKEN_KEY: 'authToken', AUTH_USER_KEY: 'authUser' };
      return name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name);
    }, module, module.exports);
    return module.exports;
  }
  return load;
}
const core = loader()(path.resolve(__dirname, '../src/utils/offlineReadCache.ts'));

function fixture() {
  const records = new Map();
  const statuses = [];
  const args = {
    key: 'userA/laska/report?date=2026-11-01', scope: 'userA/laska/admin', now: () => 1000000000,
    isOffline: () => false, isCurrent: () => true,
    load: async () => ({ rows: [{ amount: 42 }], totals: { amount: 42 } }),
    onStatus: status => statuses.push(status),
    storage: {
      get: async key => records.get(key),
      put: async entry => { records.set(entry.key, structuredClone(entry)); },
      removeScope: async scope => { for (const [key, entry] of records) if (entry.scope === scope) records.delete(key); },
    },
  };
  return { records, statuses, args };
}

test('saved result survives a new read, offline uses no network and preserves totals', async () => {
  const { args, statuses } = fixture();
  const fresh = await core.cachedRead(args);
  const cached = await core.cachedRead({ ...args, isOffline: () => true, load: () => { throw Error('must not fetch'); } });
  assert.deepEqual(cached, fresh);
  assert.deepEqual(statuses.map(s => s.source), ['network', 'device']);
  assert.equal(statuses[1].savedAt, args.now());
});
test('network and 503 failures retain successful data without replacing it with zero', async () => {
  const { args, records } = fixture();
  await core.cachedRead(args);
  for (const error of [new TypeError('fetch failed'), Object.assign(Error('unavailable'), { status: 503 }), new DOMException('slow', 'TimeoutError')]) {
    const result = await core.cachedRead({ ...args, load: async () => { throw error; } });
    assert.equal(result.totals.amount, 42);
    assert.equal(records.get(args.key).data.totals.amount, 42);
  }
});
test('missing request, different scope, expired and future copies are never replayed', async () => {
  const { args } = fixture();
  await core.cachedRead(args);
  for (const override of [
    { key: 'different period' }, { scope: 'agent/laska' },
    { now: () => args.now() + core.OFFLINE_MAX_AGE + 1 }, { now: () => args.now() - 1 },
  ]) await assert.rejects(core.cachedRead({ ...args, ...override, isOffline: () => true }), /Немає збережених/);
});
test('401 and 403 revoke saved scope, while 400 never falls back', async () => {
  for (const status of [400, 401, 403]) {
    const { args, records } = fixture();
    await core.cachedRead(args);
    await assert.rejects(core.cachedRead({ ...args, load: async () => { throw Object.assign(Error('denied'), { status }); } }), /denied/);
    assert.equal(records.size, status === 400 ? 1 : 0);
  }
});
test('cancelled requests and identity changes neither replay nor save', async () => {
  const { args, records } = fixture();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(core.cachedRead({ ...args, signal: controller.signal }), { name: 'AbortError' });
  let current = true;
  await assert.rejects(core.cachedRead({ ...args, isCurrent: () => current, load: async () => { current = false; return []; } }), { name: 'AbortError' });
  assert.equal(records.size, 0);
});
test('blocked storage still returns network data and explicitly reports persistence failure', async () => {
  const { args, statuses } = fixture();
  args.storage.get = args.storage.put = async () => { throw Error('blocked'); };
  assert.equal((await core.cachedRead(args)).totals.amount, 42);
  assert.equal(statuses[0].storageFailed, true);
});
test('an actual empty successful result is saved, but no offline copy gives an error', async () => {
  const { args } = fixture();
  await assert.rejects(core.cachedRead({ ...args, isOffline: () => true }), /Немає збережених/);
  await core.cachedRead({ ...args, load: async () => ({ rows: [], totals: null }) });
  assert.deepEqual(await core.cachedRead({ ...args, isOffline: () => true }), { rows: [], totals: null });
});
test('server diagnostics such as unsupported history survive when there is no saved copy', async () => {
  const { args } = fixture();
  const unsupported = Object.assign(Error('history not supported'), { status: 501 });
  await assert.rejects(core.cachedRead({ ...args, load: async () => { throw unsupported; } }), error => error === unsupported);
});

test('IndexedDB integration: reload, role/tenant isolation, cancellation and logout', async t => {
  const data = {};
  global.localStorage = new Proxy({
    getItem: key => data[key] ?? null,
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: key => { delete data[key]; },
  }, {
    ownKeys: () => Object.keys(data),
    getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
  });
  global.window = Object.assign(new EventTarget(), { setTimeout, clearTimeout });
  Object.defineProperty(global, 'navigator', { configurable: true, value: { onLine: true } });
  const user = { email: 'admin@test', id: 1, role: 'admin', departments: ['A'], brands: [] };
  localStorage.setItem('authToken', 'secret-never-persist');
  localStorage.setItem('authUser', JSON.stringify(user));
  localStorage.setItem('activeTenant', 'laska');
  const file = path.resolve(__dirname, '../src/api/salesOffline.ts');
  let offline = loader()(file);
  await offline.clearSalesOffline();
  let calls = 0;
  global.fetch = async () => { calls++; return new Response(JSON.stringify({ success: true, data: { amount: 100, vmd: 25 } })); };
  const parse = async response => {
    if (!response.ok) throw Object.assign(Error('denied'), { status: response.status });
    return response.json();
  };
  const read = (url = 'https://soda.test/api/sales/report?b=2&a=1', signal) => offline.offlineSalesGet('/api/sales/report', url, new Headers(), signal, parse);
  await t.test('new module instance restores same exact data from real IndexedDB without fetch', async () => {
    await read();
    offline = loader()(file);
    navigator.onLine = false;
    assert.equal((await read('https://soda.test/api/sales/report?a=1&b=2')).data.amount, 100);
    assert.equal(calls, 1);
    assert.equal((await offline.savedSalesRequests()).length, 1);
  });
  await t.test('tenant, email, raw role and department scope changes cannot expose admin VMD', async () => {
    localStorage.setItem('activeTenant', 'olgatorg');
    assert.equal((await offline.savedSalesRequests()).length, 0);
    await assert.rejects(read(), /Немає збережених/);
    localStorage.setItem('activeTenant', 'laska');
    for (const change of [{ email: 'other@test' }, { role: 'brand_manager', tenant: 'laska' }, { departments: ['B'] }]) {
      localStorage.setItem('authUser', JSON.stringify({ ...user, ...change }));
      await assert.rejects(read(), /Немає збережених/);
    }
    localStorage.setItem('authUser', JSON.stringify(user));
    assert.equal((await read()).data.vmd, 25);
  });
  await t.test('logout clears copies, and an in-flight network read cannot save them again', async () => {
    offline.saveSalesSettings('sales', { filters: { dateFrom: '2026-11-01' } });
    assert.equal(offline.readSalesSettings('sales').filters.dateFrom, '2026-11-01');
    navigator.onLine = true;
    let resolve;
    global.fetch = () => new Promise(done => { resolve = done; });
    const pending = read();
    while (!resolve) await new Promise(done => setImmediate(done));
    await offline.clearSalesOffline();
    assert.equal(offline.readSalesSettings('sales'), null);
    resolve(new Response(JSON.stringify({ data: { vmd: 999 } })));
    await assert.rejects(pending, { name: 'AbortError' });
    navigator.onLine = false;
    await assert.rejects(read(), /Немає збережених/);
  });
  await t.test('storage count is bounded and tokens are absent from persisted records', async () => {
    navigator.onLine = true;
    global.fetch = async () => new Response(JSON.stringify({ success: true, data: [] }));
    for (let i = 0; i < 52; i++) await read(`https://soda.test/api/sales/report?page=${i}`);
    const Dexie = require('dexie').default;
    const db = new Dexie('SodaSalesOfflineV1');
    db.version(1).stores({ entries: 'key, scope, savedAt' });
    const entries = await db.table('entries').toArray();
    assert.equal(entries.length, 50);
    assert.ok(!JSON.stringify(entries).includes('secret-never-persist'));
    db.close();
    await offline.clearSalesOffline();
  });
  await t.test('oversized reports remain usable online but are explicitly marked as unsaved', async () => {
    global.fetch = async () => new Response(JSON.stringify({ data: 'x'.repeat(8 * 1024 * 1024) }));
    assert.ok((await read()).data.length > 0);
    assert.equal(offline.getSalesReadStatuses(['/api/sales/report'])[0].storageFailed, true);
    navigator.onLine = false;
    await assert.rejects(read(), /Немає збережених/);
  });
  await t.test('history query-string endpoints persist list and exact store details independently across reload', async () => {
    navigator.onLine = true;
    const listPath = '/api/sales/route-history?view=stores&period=4weeks&asOfDate=2026-11-08&groupingFields=group';
    const detailPath = '/api/sales/route-history?view=details&period=4weeks&asOfDate=2026-11-08&groupingFields=group&storeCode=TT1';
    let historyCalls = 0;
    const historyRead = request => offline.offlineSalesGet(request, `https://soda.test${request}`, new Headers(), undefined, parse);
    global.fetch = async url => {
      historyCalls++;
      const isDetail = new URL(url).searchParams.get('view') === 'details';
      return new Response(JSON.stringify({ success: true, data: { periods: ['44'], stores: [{ code: 'TT1', items: isDetail ? [{ quantity: 12 }] : [] }] } }));
    };
    const list = await historyRead(listPath);
    const details = await historyRead(detailPath);
    offline = loader()(file);
    navigator.onLine = false;
    assert.deepEqual(await historyRead(listPath), list);
    assert.deepEqual(await historyRead(detailPath), details);
    assert.equal(historyCalls, 2);
    assert.equal(offline.getSalesReadStatuses([detailPath])[0].source, 'device');
    // An uncached store must not borrow another store's history or its freshness label.
    const otherStore = detailPath.replace('TT1', 'TT2');
    assert.equal(offline.getSalesReadStatuses([otherStore]).length, 0);
    for (const request of [otherStore, detailPath.replace('4weeks', '4months'), detailPath.replace('group&', 'tm&'), detailPath.replace('2026-11-08', '2026-11-09')]) {
      await assert.rejects(historyRead(request), /Немає збережених/);
    }
    // Explicitly opening the saved date remains possible on a later calendar day.
    assert.equal((await historyRead(detailPath)).data.stores[0].items[0].quantity, 12);
    localStorage.setItem('activeTenant', 'olgatorg');
    await assert.rejects(historyRead(detailPath), /Немає збережених/);
    localStorage.setItem('activeTenant', 'laska');
    await offline.clearSalesOffline();
    await assert.rejects(historyRead(detailPath), /Немає збережених/);
  });
  await t.test('all stores survive the old 50-report cap and any detail grouping works offline', async () => {
    await offline.clearSalesOffline();
    navigator.onLine = true;
    global.fetch = async () => new Response(JSON.stringify({ success: true, stores: [{ code: 'TT1', items: [{ group: 'Риба', tm: 'Karavela', product: 'Кілька', quantity: 3 }] }] }));
    const base = '/api/sales/route-history?view=details&period=4weeks&asOfDate=2026-11-09&groupingFields=group,subgroup,tm,packing&storeCode=';
    const historyRead = request => offline.offlineSalesGet(request, `https://soda.test${request}`, new Headers(), undefined, parse);
    for (let i = 0; i < 60; i++) await historyRead(base + i);
    navigator.onLine = false;
    global.fetch = () => assert.fail('offline must not fetch');
    for (const code of ['0', '59']) {
      for (const fields of ['group', 'tm', 'packing,subgroup', 'group,subgroup,tm,packing']) {
        const result = await historyRead((base + code).replace('group,subgroup,tm,packing', fields));
        assert.equal(result.stores[0].items[0].quantity, 3);
      }
    }
    await assert.rejects(historyRead((base + '0').replace('2026-11-09', '2026-11-08')), /Немає збережених/);
    await assert.rejects(historyRead(base + 'missing'), /Немає збережених/);
    await offline.clearSalesOffline();
  });
  await t.test('a real 403 removes IndexedDB copies and never falls back to privileged data', async () => {
    navigator.onLine = true;
    global.fetch = async () => new Response(JSON.stringify({ data: { vmd: 12 } }));
    await read();
    global.fetch = async () => new Response('{}', { status: 403 });
    await assert.rejects(read(), /denied/);
    navigator.onLine = false;
    await assert.rejects(read(), /Немає збережених/);
    await offline.clearSalesOffline();
  });
});
