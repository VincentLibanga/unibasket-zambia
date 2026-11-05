import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const script = await readFile(new URL('../public/script.js', import.meta.url), 'utf8');
function functionSource(name) {
  let start = script.search(new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`));
  assert.ok(start >= 0, `${name} should exist`);
  if (script.slice(start - 6, start) === 'async ') start -= 6;
  return script.slice(start, script.indexOf('\n}\n', start) + 2);
}
function classList(initial = []) {
  const values = new Set(initial);
  return {
    add: value => values.add(value), remove: value => values.delete(value),
    contains: value => values.has(value),
    toggle: (value, enabled) => enabled ? values.add(value) : values.delete(value),
  };
}
function authFixture({ passwordMatches = true, pendingCheckout = false, registration = false, mailFails = false } = {}) {
  const elements = {};
  function element(id) {
    return elements[id] ||= {
      id, value: '', textContent: '', hidden: false, inert: true,
      style: {}, dataset: {}, classList: classList(), attributes: {}, isConnected: true,
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this.attributes[name]; },
      reportValidity: () => true, reset() {},
      focus() { document.activeElement = this; },
      querySelector: () => element('menuLabel'),
    };
  }
  const header = element('header');
  header.classList.add('menu-open');
  const surroundings = [header, element('main'), element('footer')];
  const document = {
    getElementById: element,
    body: { classList: classList(['account-open']), dataset: {} },
    activeElement: element('accountPassword'),
    querySelector: () => header,
    querySelectorAll: selector => selector.startsWith('body >') ? surroundings : [element('accountPassword')],
  };
  const accountControls = ['accountEmail', 'accountPassword', 'loginSubmit', 'registerName', 'registerEmail', 'registerPassword', 'registerConfirm', 'registerRole'].map(element);
  element('accountModal').querySelectorAll = () => accountControls;
  element('accountModal').querySelector = () => element('accountPanel');
  element('basketModal').hidden = true;
  element('accountEmail').value = 'BUYER@example.test';
  element('accountPassword').value = 'test-password';
  element('registerName').value = 'New Buyer';
  element('registerEmail').value = 'new@example.test';
  element('registerPassword').value = 'new-password';
  element('registerConfirm').value = 'new-password';
  element('registerRole').value = 'buyer';
  let users = registration ? [] : [{ name: 'Test Buyer', email: 'buyer@example.test', role: 'buyer', salt: 'a'.repeat(32), verifier: 'stored-verifier' }];
  const storage = new Map();
  const historyCalls = [];
  const scrolls = [];
  let checkoutOpens = 0;
  const window = { location: new URL('http://127.0.0.1:4176/?page=account'), scrollTo: value => scrolls.push(value) };
  const context = {
    document, window, URLSearchParams, crypto: webcrypto,
    accountBusy: false, currentUser: null, pendingCheckout, resetChallenge: null,
    accountReturnFocus: element('accountButton'), SESSION_STORE: 'session',
    sessionStorage: { setItem: (key, value) => storage.set(key, value) },
    history: {
      replaceState(state, _title, target) {
        historyCalls.push({ method: 'replace', state, target });
        window.location = new URL(target, window.location.href);
      },
      pushState(state, _title, target) {
        historyCalls.push({ method: 'push', state, target });
        window.location = new URL(target, window.location.href);
      },
    },
    readAccounts: () => users,
    writeAccounts: value => { users = value; },
    passwordVerifier: async () => passwordMatches ? 'stored-verifier' : 'incorrect-verifier',
    sendAccountConfirmation: async () => { if (mailFails) throw new Error('Email unavailable.'); },
    closeBasket() {}, closeCheckout() {}, openBasket() {}, openAccount() {}, selectAccountRole() {},
    openCheckout: () => { checkoutOpens++; },
  };
  const functions = ['normaliseEmail', 'bytesToHex', 'accountError', 'clearAccountFeedback', 'setAccountBusy',
    'updateAccountButton', 'startAccountSession', 'submitLogin', 'submitRegistration', 'navigateTo',
    'applyRoute', 'closeAccount', 'toggleMobileMenu'].map(functionSource).join('\n');
  vm.createContext(context);
  vm.runInContext(functions, context);
  return { context, elements, surroundings, storage, historyCalls, scrolls, checkoutOpens: () => checkoutOpens,
    login: () => vm.runInContext('submitLogin()', context), register: () => vm.runInContext('submitRegistration()', context) };
}

test('successful login closes the account dialog, unlocks the page and replaces the login route with home', async () => {
  const { login, context, elements, surroundings, storage, historyCalls, scrolls } = authFixture();
  await login();
  assert.equal(context.currentUser.email, 'buyer@example.test');
  assert.equal(storage.get('session'), 'buyer@example.test');
  assert.equal(context.window.location.search, '');
  assert.equal(context.document.body.dataset.page, 'home');
  assert.equal(elements.accountModal.hidden, true);
  assert.equal(context.document.body.classList.contains('account-open'), false);
  assert.equal(context.accountBusy, false);
  assert.ok(surroundings.every(node => node.inert === false));
  assert.equal(elements.accountPassword.value, '');
  assert.equal(historyCalls.length, 1);
  assert.equal(historyCalls[0].method, 'replace');
  assert.equal(elements.top.style.display, '');
  assert.equal(scrolls[0].top, 0);
  assert.equal(elements.menuButton.attributes['aria-expanded'], 'false');
});

test('login requested during checkout still lands on home and clears the old checkout redirect', async () => {
  const { login, context, checkoutOpens } = authFixture({ pendingCheckout: true });
  await login();
  assert.equal(context.document.body.dataset.page, 'home');
  assert.equal(context.pendingCheckout, false);
  assert.equal(checkoutOpens(), 0);
});

test('incorrect login stays on the account form with an error and permits another attempt', async () => {
  const { login, context, elements, historyCalls } = authFixture({ passwordMatches: false });
  await login();
  assert.equal(context.currentUser, null);
  assert.equal(context.window.location.search, '?page=account');
  assert.equal(elements.accountModal.hidden, false);
  assert.match(elements.accountError.textContent, /email or password is incorrect/);
  assert.equal(elements.accountError.hidden, false);
  assert.equal(context.accountBusy, false);
  assert.equal(elements.loginSubmit.disabled, false);
  assert.equal(historyCalls.length, 0);
});

test('registration auto-login also lands on home after the form is unlocked', async () => {
  const { register, context, elements, historyCalls } = authFixture({ registration: true });
  await register();
  assert.equal(context.currentUser.email, 'new@example.test');
  assert.equal(context.document.body.dataset.page, 'home');
  assert.equal(elements.accountModal.hidden, true);
  assert.equal(context.accountBusy, false);
  assert.equal(historyCalls[0].method, 'replace');
});

test('registration email failure leaves the form available and does not redirect', async () => {
  const { register, context, elements, historyCalls } = authFixture({ registration: true, mailFails: true });
  await register();
  assert.equal(context.currentUser, null);
  assert.equal(context.accountBusy, false);
  assert.equal(elements.accountModal.hidden, false);
  assert.match(elements.accountError.textContent, /Email unavailable/);
  assert.equal(historyCalls.length, 0);
});

test('the menu disclosure updates both its visible state and accessible label', () => {
  const { context, elements } = authFixture();
  vm.runInContext('toggleMobileMenu(false)', context);
  assert.equal(elements.header.classList.contains('menu-open'), false);
  assert.equal(elements.menuButton.attributes['aria-expanded'], 'false');
  vm.runInContext('toggleMobileMenu()', context);
  assert.equal(elements.header.classList.contains('menu-open'), true);
  assert.equal(elements.menuButton.attributes['aria-label'], 'Close menu');
});
