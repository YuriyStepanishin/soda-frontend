const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(require.resolve('../src/App.tsx'), 'utf8');
const tree = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let logout;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'handleLogout') logout = node;
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(logout);
const code = ts.transpileModule(logout.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function setup(confirmed) {
  const calls = [];
  const context = {
    window: { confirm(message) { calls.push('confirm'); assert.match(message, /Незбережені зміни/); return confirmed; } },
    queryClient: { async cancelQueries() { calls.push('cancel-queries'); }, clear() { calls.push('clear-cache'); } },
    clearAuthSession() { calls.push('clear-session'); },
    setEmail(value) { assert.equal(value, null); calls.push('email'); },
    setActiveDatabase(value) { assert.equal(value, ''); calls.push('tenant'); },
    localStorage: { removeItem(key) { assert.equal(key, 'activeTenant'); calls.push('storage'); } },
    resetToHome() { calls.push('home'); },
    setIsUserMenuOpen(value) { assert.equal(value, true); calls.push('login'); },
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return { calls, run: () => vm.runInContext('handleLogout()', context) };
}

test('cancel logout preserves session, tenant, navigation and cache', async () => {
  const { calls, run } = setup(false);
  await run();
  assert.deepEqual(calls, ['confirm']);
});

test('confirmed logout cancels reads before clearing session and cached tenant data', async () => {
  const { calls, run } = setup(true);
  await run();
  assert.deepEqual(calls, ['confirm', 'cancel-queries', 'clear-session', 'email', 'tenant', 'storage', 'clear-cache', 'home', 'login']);
});

test('daily sales returns to its entry screen for both home and sales entry points', () => {
  const entryPoints = [];
  let back;
  function findNavigation(node) {
    if (ts.isJsxAttribute(node) && node.name.text === 'onOpenSalesByDays') {
      entryPoints.push(node.initializer.expression.getText(tree));
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === 'SalesByDaysPage') {
      back = node.attributes.properties.find(property => property.name?.text === 'onBack').initializer.expression.getText(tree);
    }
    ts.forEachChild(node, findNavigation);
  }
  findNavigation(tree);
  assert.equal(entryPoints.length, 2);
  for (const origin of ['home', 'sales']) {
    const context = {
      salesByDaysOrigin: '', page: '',
      setSalesByDaysOrigin(value) { context.salesByDaysOrigin = value; },
      setPage(value) { context.page = value; },
      runProtectedAction(action) { action(); },
    };
    vm.createContext(context);
    const entry = entryPoints.find(expression => expression.includes("setSalesByDaysOrigin('" + origin + "')"));
    assert.ok(entry);
    vm.runInContext('(' + entry + ')()', context);
    assert.equal(context.page, 'sales-by-days');
    vm.runInContext('(' + back + ')()', context);
    assert.equal(context.page, origin);
  }
});
