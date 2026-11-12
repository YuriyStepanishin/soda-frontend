import test from 'node:test';
import assert from 'node:assert/strict';
import { installAppExitGuard } from '../src/utils/appExitGuard.ts';

function setup({ handled = false, confirmed = false, state = { idx: 0, routerKey: 'kept' } } = {}) {
  const calls = [];
  const listeners = new Map();
  const history = {
    state,
    replaceState(value) { this.state = value; calls.push('replace'); },
    pushState(value) { this.state = value; calls.push('push'); },
    forward() { calls.push('forward'); },
    back() { calls.push('back'); },
  };
  globalThis.window = { history, addEventListener(name, handler) { listeners.set(name, handler); }, removeEventListener(name) { listeners.delete(name); } };
  const cleanup = installAppExitGuard({ onBack() { calls.push('screen-back'); return handled; }, confirmExit() { calls.push('confirm'); return confirmed; } });
  return { calls, listeners, history, cleanup, pop: () => listeners.get('popstate')({ state: { sodaNavigationGuard: 'root' } }) };
}

test('warn before reload/close without changing auth or router state; clean up listeners', () => {
  const app = setup();
  assert.equal(app.history.state.routerKey, 'kept');
  let prevented = false;
  const event = { preventDefault() { prevented = true; }, returnValue: '' };
  app.listeners.get('beforeunload')(event);
  assert.equal(prevented, true);
  assert.equal(event.returnValue, true);
  app.cleanup();
  assert.equal(app.listeners.size, 0);
});
test('native Back returns one in-app step without an exit prompt', () => {
  const app = setup({ handled: true });
  app.pop();
  assert.deepEqual(app.calls, ['replace', 'push', 'screen-back', 'forward']);
  app.cleanup();
});
test('cancel at home restores active history entry and keeps the application open', () => {
  const app = setup();
  app.pop();
  assert.deepEqual(app.calls, ['replace', 'push', 'screen-back', 'confirm', 'forward']);
  app.cleanup();
});
test('confirmed exit proceeds and does not show a second beforeunload prompt', () => {
  const app = setup({ confirmed: true });
  app.pop();
  assert.equal(app.calls.at(-1), 'back');
  app.listeners.get('beforeunload')({ preventDefault() { assert.fail('duplicate prompt'); } });
  app.cleanup();
});
test('remount/reload reuses the guard; forward traversal does not request exit', () => {
  const app = setup({ state: { sodaNavigationGuard: 'active', idx: 0 } });
  app.listeners.get('popstate')({ state: { sodaNavigationGuard: 'active' } });
  assert.deepEqual(app.calls, []);
  app.cleanup();
});
