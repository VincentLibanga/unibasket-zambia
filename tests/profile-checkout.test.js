import assert from 'node:assert/strict';
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

async function checkoutScenario(currentUser, enteredName, {
  statuses = ['successful'], initiateStatus = 'pending', confirmationAvailable = true, initiationNetworkFailure = false,
  gatewayCode, gatewayTransactionId,
} = {}) {
  const elements = Object.fromEntries([
    'checkoutError', 'checkoutName', 'confirmationName', 'orderId', 'paymentRef',
    'paymentMethodPaid', 'orderTotal', 'receiptStatus', 'checkoutForm', 'checkoutSuccess',
    'count', 'checkoutSubmit', 'checkoutPhone', 'paymentMethod', 'deliveryMethod', 'deliveryNote', 'paymentStatus', 'checkoutItems', 'checkoutTotal'
  ].map(id => [id, { textContent: '', hidden: false, value: '' }]));
  elements.checkoutName.value = enteredName;
  elements.checkoutName.focus = () => {};
  elements.paymentMethod.value = 'mobile_money';
  let sentBody;
  const calls = [];
  const storage = new Map();
  let verificationCount = 0;
  const context = {
    currentUser,
    pendingPayment: null,
    checkoutBusy: false,
    cart: [{ i: 0, q: 1 }],
    products: [['Oats', 'Groceries', 65, '', '', '', '', 1]],
    AbortSignal,
    setTimeout: callback => { callback(); },
    sessionStorage: { setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    document: {
      getElementById: id => elements[id],
      querySelectorAll: () => ['checkoutName', 'checkoutPhone', 'paymentMethod', 'deliveryMethod', 'deliveryNote'].map(id => elements[id]),
    },
    fetch: async (url, options) => {
      calls.push(url);
      if (url.endsWith('/checkout')) {
        sentBody = JSON.parse(options.body);
        return { ok: true, json: async () => ({ data: {
          reference: 'UBZ-TEST', token: 'a'.repeat(64), name: currentUser.name, email: currentUser.email,
          amount: 90, currency: 'ZMW', status: 'created',
        } }) };
      }
      if (url.endsWith('/initiate')) {
        if (initiationNetworkFailure) throw new Error('Connection lost');
        return { ok: true, json: async () => ({ data: {
          status: initiateStatus, confirmationAvailable, gatewayCode, paymentRef: gatewayTransactionId,
          code: initiateStatus === 'failed' ? 'PAYMENT_AUTH_FAILED' : undefined,
          message: initiateStatus === 'failed' ? 'ZynlePay rejected the shop’s sandbox credentials.' : undefined,
        } }) };
      }
      const status = statuses[Math.min(verificationCount++, statuses.length - 1)];
      return {
        ok: true,
        json: async () => ({ data: {
          status, confirmationAvailable, gatewayCode, name: currentUser.name, email: currentUser.email,
          orderId: 'UBZ-TEST', paymentRef: gatewayTransactionId || 'ZYNLEPAY-TEST', paymentMethod: 'Mobile money via ZynlePay', total: 90, emailSent: true
        } })
      };
    },
    renderBasket: () => {}
  };
  elements.checkoutSuccess.hidden = true;
  const functions = ['submitCheckout', 'paymentApi', 'setCheckoutBusy', 'showPaymentStatus',
    'savePendingPayment', 'confirmZynlePayment', 'applyPaymentResult', 'showCheckoutConfirmation', 'updateCheckoutTotal',
    'basketSubtotal', 'deliveryCharge'].map(functionSource).join('\n');
  await vm.runInNewContext(`${functions}\nsubmitCheckout();`, context);
  return { elements, sentBody, calls, context, storage };
}

function guestCheckoutAttempt() {
  const elements = {
    checkoutError: { textContent: '', hidden: true },
  };
  const calls = [];
  const context = {
    currentUser: null,
    pendingCheckout: false,
    cart: [{ i: 0, q: 1 }],
    document: {
      getElementById: id => elements[id],
    },
    closeCheckout: () => calls.push('closeCheckout'),
    navigateTo: page => calls.push(`navigateTo:${page}`),
    accountError: message => { elements.checkoutError.textContent = message; },
  };
  vm.runInNewContext(`${functionSource('submitCheckout')}\nsubmitCheckout();`, context);
  return { calls, elements };
}

test('order confirmation uses the signed-in profile name', async () => {
  const { elements, sentBody } = await checkoutScenario({ name: 'Vince Buyer', email: 'buyer@example.test' }, 'Different Guest');
  assert.equal(sentBody.name, 'Vince Buyer');
  assert.equal(sentBody.email, 'buyer@example.test');
  assert.deepEqual(sentBody.items, [{ name: 'Oats', price: 65, quantity: 1 }]);
  assert.equal(elements.confirmationName.textContent, 'Thank you, Vince Buyer.');
  assert.equal(elements.checkoutSuccess.hidden, false);
  assert.equal(elements.orderTotal.textContent, 'ZMW 90');
  assert.equal(elements.paymentMethodPaid.textContent, 'Mobile money via ZynlePay');
  assert.match(elements.receiptStatus.textContent, /receipt has been emailed to buyer@example.test/);
});

test('ZynlePay checkout waits for server verification before showing success', async () => {
  const { calls, sentBody, context } = await checkoutScenario({ name: 'Vince Buyer', email: 'buyer@example.test' }, '', { statuses: ['pending', 'successful'] });
  assert.deepEqual(calls, ['/api/payments/checkout', '/api/payments/initiate', '/api/payments/verify', '/api/payments/verify']);
  assert.equal('outcome' in sentBody, false);
  assert.equal(context.cart.length, 0);
  assert.equal(context.pendingPayment, null);
});

test('pending ZynlePay payment preserves the basket and offers a status check', async () => {
  const { elements, context, storage } = await checkoutScenario({ name: 'Vince Buyer', email: 'buyer@example.test' }, '', { statuses: ['pending'] });
  assert.equal(context.cart.length, 1);
  assert.equal(elements.checkoutSuccess.hidden, true);
  assert.equal(elements.checkoutSubmit.textContent, 'Check payment status');
  assert.equal(elements.checkoutPhone.disabled, true);
  assert.equal(storage.size, 1);
  assert.equal(context.pendingPayment.amount, 90);
  assert.equal(elements.checkoutTotal.textContent, 'ZMW 90');
});

test('a restored pending payment shows its original total and quantity after the cart is cleared', () => {
  const elements = { checkoutItems: {}, checkoutTotal: {} };
  const context = {
    pendingPayment: { amount: 90, items: [{ id: 1, quantity: 1 }] }, cart: [],
    document: { getElementById: id => elements[id] },
  };
  vm.runInNewContext(`${functionSource('updateCheckoutTotal')}\nupdateCheckoutTotal();`, context);
  assert.equal(elements.checkoutItems.textContent, '1 items');
  assert.equal(elements.checkoutTotal.textContent, 'ZMW 90');
});

test('a failed pending payment restores the current basket total before another payment', async () => {
  const { elements, context } = await checkoutScenario({ name: 'Test Buyer', email: 'buyer@example.test' }, '', {
    statuses: ['pending'], confirmationAvailable: false,
  });
  context.cart[0].q = 2;
  vm.runInNewContext('try { applyPaymentResult({ status: "failed" }); } catch {}', context);
  assert.equal(context.pendingPayment, null);
  assert.equal(elements.checkoutTotal.textContent, 'ZMW 155');
  assert.equal(elements.checkoutItems.textContent, '2 items');
});

test('declined and rejected credentials keep the basket and allow retry', async () => {
  for (const scenario of [{ statuses: ['failed'] }, { initiateStatus: 'failed' }]) {
    const { elements, context, storage } = await checkoutScenario({ name: 'Vince Buyer', email: 'buyer@example.test' }, '', scenario);
    assert.equal(context.cart.length, 1);
    assert.equal(elements.checkoutSuccess.hidden, true);
    assert.equal(elements.checkoutError.hidden, false);
    assert.equal(elements.checkoutSubmit.textContent, 'Pay with ZynlePay');
    assert.equal(elements.checkoutPhone.disabled, false);
    assert.equal(storage.size, 0);
  }
});

test('a submitted request stays pending when gateway confirmation is unavailable', async () => {
  const { elements, context, calls } = await checkoutScenario({ name: 'Vince Buyer', email: 'buyer@example.test' }, '', { statuses: ['pending'], confirmationAvailable: false });
  assert.equal(context.cart.length, 1);
  assert.equal(elements.checkoutSuccess.hidden, true);
  assert.equal(calls.filter(url => url.endsWith('/verify')).length, 1);
  assert.match(elements.paymentStatus.textContent, /sandbox dashboard before paying again/);
});

test('transaction-initiated status shows its reference without confirming the order', async () => {
  const { elements, context } = await checkoutScenario({ name: 'Vince Buyer', email: 'buyer@example.test' }, '', {
    statuses: ['pending'], confirmationAvailable: false, gatewayCode: '120', gatewayTransactionId: '1234567890',
  });
  assert.equal(context.cart.length, 1);
  assert.equal(elements.checkoutSuccess.hidden, true);
  assert.match(elements.paymentStatus.textContent, /initiated the test request\. Confirmation is pending/);
  assert.match(elements.paymentStatus.textContent, /Transaction: 1234567890/);
  assert.equal(context.pendingPayment.paymentRef, '1234567890');
});

test('status code 995 stays unconfirmed and a second check does not submit another payment', async () => {
  const { elements, context, calls } = await checkoutScenario({ name: 'Vince Buyer', email: 'buyer@example.test' }, '', {
    statuses: ['pending'], confirmationAvailable: false, gatewayCode: '995', gatewayTransactionId: '1234567890',
  });
  assert.equal(elements.checkoutSuccess.hidden, true);
  assert.equal(context.cart.length, 1);
  assert.match(elements.paymentStatus.textContent, /could not confirm completion.*995/);
  assert.equal(elements.checkoutSubmit.textContent, 'Check payment status');
  await vm.runInNewContext(`${functionSource('submitCheckout')}\nsubmitCheckout();`, context);
  assert.equal(calls.filter(url => url.endsWith('/checkout')).length, 1);
  assert.equal(calls.filter(url => url.endsWith('/initiate')).length, 1);
  assert.equal(calls.filter(url => url.endsWith('/verify')).length, 2);
  assert.equal(context.cart.length, 1);
});

test('ambiguous initiation error preserves the reference and basket for status recovery', async () => {
  const { elements, context, storage } = await checkoutScenario({ name: 'Vince Buyer', email: 'buyer@example.test' }, '', { initiationNetworkFailure: true });
  assert.equal(context.cart.length, 1);
  assert.equal(elements.checkoutSuccess.hidden, true);
  assert.equal(storage.size, 1);
  assert.equal(elements.checkoutSubmit.textContent, 'Check payment status');
});

test('guest payment is blocked until an account is created', () => {
  const { calls, elements } = guestCheckoutAttempt();
  assert.deepEqual(calls, ['closeCheckout', 'navigateTo:account']);
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
