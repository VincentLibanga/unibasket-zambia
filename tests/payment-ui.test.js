import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../public/payments.js', import.meta.url), 'utf8');
const functions = source.slice(0, source.indexOf('\nloadPaymentConfiguration();'));
const reference = 'UBP-' + 'A'.repeat(32);
const result = changes => ({ reference, provider: 'ZynlePay', mode: 'test', currency: 'ZMW', total: 90,
  paymentStatus: 'pending', checkoutUrl: null, confirmationAvailable: false,
  emailSent: false, name: 'Buyer', email: 'buyer@example.test', items: [{ id: 1, quantity: 1 }], ...changes });

function fixture({ respond, storageUnavailable = false, search = '', pending, bootstrap = false } = {}) {
  const ids = ['onlinePaymentSubmit', 'onlinePaymentNote', 'checkoutForm', 'deliveryMethod', 'deliveryNote',
    'checkoutError', 'basketFooter', 'basketCheckout', 'basketDeliveryNote', 'basketTotalLabel', 'subtotal',
    'checkoutModal', 'checkoutSuccess', 'confirmationHeading', 'confirmationName', 'confirmationIcon',
    'paymentPhone', 'paymentActions', 'emailInsteadButton', 'newPaymentButton', 'checkPaymentButton', 'confirmationDescription',
    'orderPaymentStatus', 'orderId', 'orderTotal', 'receiptStatus', 'confirmationPaymentNote'];
  const elements = Object.fromEntries(ids.map(id => [id, { hidden: false, disabled: false, textContent: '', value: '', reportValidity: () => true, focus() {} }]));
  elements.paymentPhone.value = '097 000 0000';
  elements.deliveryMethod.value = 'campus';
  elements.deliveryNote.value = 'Main campus';
  const storage = new Map();
  if (pending) storage.set('unibasket.zynlepay.pending.v1', JSON.stringify(pending));
  const calls = [];
  const redirects = [];
  const context = {
    currentUser: { name: 'Buyer', email: 'buyer@example.test' }, cart: [{ i: 0, q: 1 }], products: [['Notebook', 'Stationery', 65, '', '', '', '', 1]],
    checkoutBusy: false, pendingOrder: null, crypto: webcrypto, URL, URLSearchParams, AbortSignal,
    document: { getElementById: id => elements[id], body: { classList: { add() {} } } },
    window: { location: { search, assign: url => redirects.push(url) } }, history: { replaceState() {} },
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => {
      if (storageUnavailable) throw new Error('Storage unavailable'); storage.set(key, value);
    }, removeItem: key => storage.delete(key) },
    setCheckoutBusy: value => { context.checkoutBusy = value; }, renderBasket() {}, closeBasket() {}, closeCheckout() {},
    navigateTo() {}, accountError() {}, updateCartBadge() {}, openCheckout: options => { context.emailCheckout = options; },
    fetch: async (url, options) => {
      const body = options ? JSON.parse(options.body) : undefined;
      calls.push({ url, body, options });
      if (respond) return respond(url, body, calls.length);
      return { ok: true, json: async () => ({ data: options ? result() : { available: true, mode: 'test' } }) };
    },
  };
  vm.createContext(context);
  vm.runInContext(bootstrap ? source : functions, context);
  return { context, elements, storage, calls, redirects, run: expression => vm.runInContext(expression, context) };
}

test('sandbox checkout saves its private recovery key and sends product IDs without prices', async () => {
  const { run, calls, redirects, storage, context } = fixture();
  await run('submitOnlinePayment()');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/payments/initiate');
  assert.deepEqual(calls[0].body.items, [{ id: 1, quantity: 1 }]);
  assert.equal('price' in calls[0].body.items[0], false);
  assert.equal(redirects.length, 0);
  assert.equal(calls[0].body.phone, '097 000 0000');
  assert.equal(JSON.parse(storage.get('unibasket.zynlepay.pending.v1')).reference, reference);
  assert.equal(context.cart.length, 1);
});

test('blocked browser storage prevents a payment request or redirect', async () => {
  const { run, calls, redirects, elements } = fixture({ storageUnavailable: true });
  await run('submitOnlinePayment()');
  assert.equal(calls.length, 0);
  assert.equal(redirects.length, 0);
  assert.match(elements.checkoutError.textContent, /session storage/);
});

test('lost initialization responses reuse the same saved request key', async () => {
  const { run, calls, context, elements } = fixture({ respond: async (_url, _body, attempt) => {
    if (attempt === 1) throw new Error('Connection lost');
    return { ok: true, json: async () => ({ data: result({ checkoutUrl: null }) }) };
  } });
  await run('submitOnlinePayment()');
  assert.equal(context.cart.length, 1);
  await run('checkOnlinePayment()');
  assert.equal(calls[0].body.idempotencyKey, calls[1].body.idempotencyKey);
  assert.equal(elements.orderPaymentStatus.textContent, 'Pending (test)');
});

test('confirmed payment clears submitted quantities once and receipt failure stays paid', async () => {
  const { run, context, elements } = fixture({ respond: async () => ({ ok: true, json: async () => ({ data: result({ paymentStatus: 'paid', checkoutUrl: null }) }) }) });
  await run('submitOnlinePayment()');
  assert.equal(context.cart.length, 0);
  assert.equal(elements.orderPaymentStatus.textContent, 'Paid (test)');
  assert.match(elements.receiptStatus.textContent, /receipt email is pending/);
  context.cart = [{ i: 0, q: 2 }];
  await run('checkOnlinePayment()');
  assert.equal(context.cart[0].q, 2);
});

test('provider URL injection is blocked and malformed payment results retain the basket', async () => {
  for (const change of [{ checkoutUrl: 'https://evil.example' }, { paymentStatus: 'unknown' }, { currency: 'USD' }, { provider: 'Flutterwave' }, { mode: 'live' }]) {
    const { run, context, redirects, elements } = fixture({ respond: async () => ({ ok: true, json: async () => ({ data: result(change) }) }) });
    await run('submitOnlinePayment()');
    assert.equal(context.cart.length, 1);
    assert.equal(redirects.length, 0);
    assert.equal(elements.orderPaymentStatus.textContent, 'Not confirmed');
  }
});

test('a forged successful return URL cannot confirm payment or clear the basket', async () => {
  const pending = { idempotencyKey: webcrypto.randomUUID(), reference,
    details: { items: [{ id: 1, quantity: 1 }] }, result: result() };
  const { context, elements, calls } = fixture({ pending, bootstrap: true, search: '?payment_return=1&status=successful&transaction_id=999',
    respond: async url => ({ ok: true, json: async () => ({ data: url.endsWith('/config') ? { available: true, mode: 'test' } : result({ checkoutUrl: null }) }) }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(calls.some(call => call.url === '/api/payments/' + reference + '/verify'));
  assert.equal(context.cart.length, 1);
  assert.equal(elements.orderPaymentStatus.textContent, 'Pending (test)');
});

test('unavailable payment configuration disables online checkout with a clear message', async () => {
  const { run, elements } = fixture({ respond: async () => ({ ok: true, json: async () => ({ data: { available: false, mode: 'test' } }) }) });
  await run('loadPaymentConfiguration()');
  assert.equal(elements.onlinePaymentSubmit.disabled, true);
  assert.match(elements.onlinePaymentNote.textContent, /currently unavailable/);
});


test('email checkout remains accessible while a sandbox payment is pending', async () => {
  const { run, context } = fixture();
  await run('submitOnlinePayment()');
  context.cart = [];
  run('openEmailCheckout()');
  assert.equal(context.emailCheckout.emailOnly, true);
  assert.equal(context.cart.length, 1);
  assert.equal(run('hasPendingOnlinePayment()'), true);
});

test('sandbox payment requires a simulator number without submitting a charge', async () => {
  const { run, elements, calls } = fixture();
  elements.paymentPhone.value = '';
  await run('submitOnlinePayment()');
  assert.equal(calls.length, 0);
  assert.match(elements.checkoutError.textContent, /sandbox simulator/);
});
