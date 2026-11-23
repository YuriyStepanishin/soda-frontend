const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Regression: UserMenu owns the login Modal. Unmounting the navigation while
// closing the menu also unmounts the login form and interrupts authentication.
test('closing navigation does not unmount its login/profile portal', () => {
  const shell = fs.readFileSync(path.resolve(__dirname, '../src/components/AppShell/AppShell.tsx'), 'utf8');
  const css = fs.readFileSync(path.resolve(__dirname, '../src/components/AppShell/AppShell.module.css'), 'utf8');
  const userMenu = fs.readFileSync(path.resolve(__dirname, '../src/components/UserMenu/UserMenu.tsx'), 'utf8');
  assert.match(shell, /<nav id="soda-section-menu"[^>]*hidden=\{!menuOpen\}/);
  assert.doesNotMatch(shell, /\{menuOpen\s*&&\s*<nav id="soda-section-menu"/);
  assert.match(css, /\.sectionMenu\[hidden\]\s*\{\s*display\s*:\s*none\s*!important/);
  assert.match(shell, /\{account\}/);
  assert.match(userMenu, /isOpen\s*&&\s*\(/);
  assert.match(userMenu, /<Modal title=\{email \? 'Профіль' : 'Вхід у SODA'\}/);
});
