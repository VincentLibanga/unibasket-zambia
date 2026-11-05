import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const script = await readFile(new URL('../public/script.js', import.meta.url), 'utf8');

function functionSource(name) {
  let start = script.search(new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`));
  assert.notEqual(start, -1, `${name} should exist`);
  if (script.slice(start - 6, start) === 'async ') start -= 6;
  const end = script.indexOf('\n}\n', start);
  assert.notEqual(end, -1, `${name} should have a closing brace`);
  return script.slice(start, end + 2);
}

function checkoutFixture({ currentUser = { name: 'Vince Buyer', email: 'buyer@example.test' }, respond } = {}) {
  const elements = Object.fromEntries([
    'checkoutError', 'checkoutName', 'confirmationName', 'orderId', 'orderPaymentStatus',
    'orderTotal', 'receiptStatus', 'checkoutForm', 'checkoutSuccess', 'checkoutReceiptEmail',
    'checkoutModal', 'count', 'checkoutSubmit', 'deliveryMethod', 'deliveryNote', 'orderStatus', 'checkoutItems', 'checkoutTotal',
  ].map(id => [id, { textContent: '', hidden: false, value: '' }]));
  elements.deliveryMethod.value = 'campus';
  elements.deliveryNote.value = 'Main campus';
  elements.checkoutName.value = 'Different Guest';
  elements.checkoutSuccess.hidden = true;
  const calls = [];
  const storage = new Map();
  const navigation = [];
  const context = {
    currentUser, pendingOrder: null, checkoutBusy: false,
    cart: [{ i: 0, q: 1 }], products: [['Oats', 'Groceries', 65, '', '', '', '', 1]],
    AbortSignal, crypto: webcrypto,
    sessionStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key),
    },
    document: {
      getElementById: id => elements[id], body: { classList: { add() {}, remove() {} } },
      querySelectorAll: () => ['checkoutName', 'deliveryMethod', 'deliveryNote'].map(id => elements[id]),
    },
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, body });
      if (respond) {
        const response = await respond(body, calls.length);
        if (response) return response;
      }
      return { ok: true, json: async () => ({ data: {
        status: 'confirmed', paymentStatus: 'unpaid', emailSent: true,
        name: body.name, email: body.email, orderId: 'UBZ-TEST', total: 90,
      } }) };
    },
    closeBasket() {}, renderBasket() {},
    navigateTo: page => navigation.push(page),
    showToast: message => navigation.push(message),
    accountError: message => { elements.checkoutError.textContent = message; },
  };
  const functions = ['openCheckout', 'closeCheckout', 'submitCheckout', 'orderApi', 'setCheckoutBusy', 'showOrderStatus',
    'readPendingOrder', 'savePendingOrder', 'showCheckoutConfirmation', 'updateCheckoutTotal',
    'basketSubtotal', 'deliveryCharge', 'updateCartBadge'].map(functionSource).join('\n');
  vm.createContext(context);
  vm.runInContext(functions, context);
  return { context, elements, calls, storage, navigation, submit: () => vm.runInContext('submitCheckout()', context) };
}

test('checkout places one unpaid order, emails the signed-in buyer and clears submitted items', async () => {
  const { submit, elements, calls, context, storage } = checkoutFixture();
  await submit();
  assert.deepEqual(calls.map(call => call.url), ['/api/orders']);
  assert.equal(calls[0].body.name, 'Vince Buyer');
  assert.equal(calls[0].body.email, 'buyer@example.test');
  assert.deepEqual(calls[0].body.items, [{ name: 'Oats', price: 65, quantity: 1 }]);
  assert.equal('paymentMethod' in calls[0].body, false);
  assert.equal('phone' in calls[0].body, false);
  assert.equal(elements.confirmationName.textContent, 'Thank you, Vince Buyer.');
  assert.equal(elements.orderPaymentStatus.textContent, 'Unpaid');
  assert.equal(elements.orderTotal.textContent, 'ZMW 90');
  assert.equal(elements.checkoutSuccess.hidden, false);
  assert.match(elements.receiptStatus.textContent, /emailed to buyer@example.test/);
  assert.equal(context.cart.length, 0);
  assert.equal(context.pendingOrder, null);
  assert.equal(storage.size, 0);
});

test('checkout shows the receipt destination before submission', () => {
  const { context, elements } = checkoutFixture();
  vm.runInContext('openCheckout()', context);
  assert.equal(elements.checkoutReceiptEmail.textContent, 'Your order receipt will be emailed to buyer@example.test.');
  assert.equal(elements.checkoutName.value, 'Vince Buyer');
  assert.equal(elements.checkoutSubmit.textContent, 'Place order & email receipt');
});

test('SMTP failure preserves the basket and retries with identical order details and request key', async () => {
  const { submit, elements, context, calls, storage } = checkoutFixture({ respond: async (_body, attempt) => attempt === 1
    ? { ok: false, json: async () => ({ error: { code: 'MAIL_UNREACHABLE', message: 'SMTP could not be reached.' } }) }
    : null,
  });
  await submit();
  assert.equal(context.cart.length, 1);
  assert.equal(elements.checkoutSuccess.hidden, true);
  assert.equal(elements.checkoutSubmit.textContent, 'Retry email confirmation');
  assert.equal(storage.size, 1);
  assert.equal(elements.deliveryMethod.disabled, true);
  await submit();
  assert.deepEqual(calls[0].body, calls[1].body);
  assert.equal(elements.checkoutSuccess.hidden, false);
  assert.equal(context.pendingOrder, null);
});

test('lost HTTP responses preserve the request key and retry the same order', async () => {
  const { submit, context, calls } = checkoutFixture({ respond: async (_body, attempt) => {
    if (attempt === 1) throw new Error('Connection lost');
  } });
  await submit();
  assert.equal(context.cart.length, 1);
  await submit();
  assert.equal(calls[0].body.idempotencyKey, calls[1].body.idempotencyKey);
  assert.equal(context.cart.length, 0);
});

test('validation failures unlock the form and preserve the basket for correction', async () => {
  const { submit, context, elements, storage } = checkoutFixture({ respond: async () => ({
    ok: false, json: async () => ({ error: { code: 'INVALID_ORDER_DETAILS', message: 'Enter a delivery note.' } }),
  }) });
  await submit();
  assert.equal(context.cart.length, 1);
  assert.equal(context.pendingOrder, null);
  assert.equal(storage.size, 0);
  assert.equal(elements.deliveryNote.disabled, false);
  assert.equal(elements.checkoutSubmit.textContent, 'Place order & email receipt');
});

test('an unfinished order restores its total and email after reload without the original basket', async () => {
  const { submit, context, elements } = checkoutFixture({ respond: async () => { throw new Error('Connection lost'); } });
  await submit();
  context.pendingOrder = vm.runInContext('readPendingOrder()', context);
  context.cart = [];
  vm.runInContext('openCheckout()', context);
  assert.equal(elements.checkoutTotal.textContent, 'ZMW 90');
  assert.equal(elements.checkoutItems.textContent, '1 items');
  assert.match(elements.checkoutReceiptEmail.textContent, /buyer@example.test/);
});

test('another signed-in account cannot retry a saved order for a different buyer', async () => {
  const { submit, context, calls, elements } = checkoutFixture({ respond: async () => { throw new Error('Connection lost'); } });
  await submit();
  context.currentUser = { name: 'Another Buyer', email: 'another@example.test' };
  await submit();
  assert.equal(calls.length, 1);
  assert.match(elements.checkoutError.textContent, /account used for this order/);
});

test('double clicks share the active submission and new basket quantities remain', async () => {
  let release;
  const { submit, context, calls } = checkoutFixture({ respond: async () => new Promise(resolve => { release = resolve; }) });
  const first = submit();
  context.cart[0].q = 2;
  await submit();
  assert.equal(calls.length, 1);
  release(null);
  await first;
  assert.equal(context.cart[0].q, 1);
});

test('invalid success responses cannot clear the basket or show an order confirmation', async () => {
  const { submit, context, elements } = checkoutFixture({ respond: async () => ({
    ok: true, json: async () => ({ data: { status: 'confirmed', emailSent: false, paymentStatus: 'paid' } }),
  }) });
  await submit();
  assert.equal(context.cart.length, 1);
  assert.equal(elements.checkoutSuccess.hidden, true);
  assert.match(elements.checkoutError.textContent, /could not be verified/);
});

test('guest checkout requires sign-in before an order can be emailed', async () => {
  const { submit, calls, elements, navigation } = checkoutFixture({ currentUser: null });
  await submit();
  assert.equal(calls.length, 0);
  assert.deepEqual(navigation, ['account']);
  assert.match(elements.checkoutError.textContent, /Create an account or sign in/);
});

test('profile name edit updates the saved account and active session', () => {
  const currentUser = { name: 'Old Name', email: 'buyer@example.test', role: 'buyer' };
  const storedUsers = [{ ...currentUser, salt: 'a'.repeat(32), verifier: 'b'.repeat(64) }];
  const elements = {
    profileNameInput: { value: '  New Name  ', reportValidity: () => true },
    profileName: { textContent: '' },
    profileSaveStatus: { textContent: '', hidden: true },
    accountStatus: { textContent: '' }
  };
  let savedUsers;
  const context = {
    currentUser,
    accountBusy: false,
    clearAccountFeedback: () => {},
    readAccounts: () => storedUsers,
    writeAccounts: users => { savedUsers = users; },
    accountError: message => { throw new Error(message); },
    document: { getElementById: id => elements[id] }
  };
  vm.runInNewContext(`${functionSource('saveProfileName')}\nsaveProfileName();`, context);
  assert.equal(savedUsers[0].name, 'New Name');
  assert.equal(currentUser.name, 'New Name');
  assert.equal(elements.profileName.textContent, 'New Name');
  assert.equal(elements.profileSaveStatus.hidden, false);
});
