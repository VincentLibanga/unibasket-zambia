import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const script = await readFile(new URL('../public/script.js', import.meta.url), 'utf8');

function functionSource(name) {
  let start = script.search(new RegExp(`function\\s+${name}\\s*\\(\\)\\s*\\{`));
  assert.notEqual(start, -1, `${name} should exist`);
  if (script.slice(start - 6, start) === 'async ') start -= 6;
  const end = script.indexOf('\n}\n', start);
  assert.notEqual(end, -1, `${name} should have a closing brace`);
  return script.slice(start, end + 2);
}

async function checkoutScenario(currentUser, enteredName) {
  const elements = Object.fromEntries([
    'checkoutError', 'checkoutName', 'confirmationName', 'orderId', 'paymentRef',
    'paymentMethodPaid', 'orderTotal', 'receiptStatus', 'checkoutForm', 'checkoutSuccess',
    'count', 'checkoutSubmit', 'checkoutPhone', 'paymentMethod', 'deliveryMethod', 'deliveryNote'
  ].map(id => [id, { textContent: '', hidden: false, value: '' }]));
  elements.checkoutName.value = enteredName;
  elements.checkoutName.focus = () => {};
  elements.paymentMethod.value = 'mtn_momo';
  let sentBody;
  const context = {
    currentUser,
    cart: [{ i: 0, q: 1 }],
    products: [['Oats', 'Groceries', 65]],
    document: {
      getElementById: id => elements[id],
      querySelector: () => ({ value: 'SUCCESS' })
    },
    fetch: async (_url, options) => {
      sentBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ data: {
          orderId: 'UBZ-TEST', paymentRef: 'DEMO-TEST', paymentMethod: 'MTN MoMo', total: 80, emailSent: true
        } })
      };
    },
    renderBasket: () => {}
  };
  await vm.runInNewContext(`${functionSource('submitCheckout')}\nsubmitCheckout();`, context);
  return { elements, sentBody };
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
  assert.equal(elements.orderTotal.textContent, 'ZMW 80');
  assert.equal(elements.paymentMethodPaid.textContent, 'MTN MoMo');
  assert.match(elements.receiptStatus.textContent, /receipt has been emailed to buyer@example.test/);
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
