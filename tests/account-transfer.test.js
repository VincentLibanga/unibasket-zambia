import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const script = await readFile(new URL('../public/script.js', import.meta.url), 'utf8');
function source(name) {
  const start = script.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  return script.slice(start, script.indexOf('\n}\n', start) + 2);
}
const user = (email, role = 'buyer') => ({ name: 'Test User', email, role, salt: 'a'.repeat(32), verifier: 'b'.repeat(64) });
const listing = { id: 'seller-test-1', name: 'Notebook', category: 'Stationery', price: 20, stockQuantity: 5, description: 'A notebook', sellerEmail: 'seller@example.test', imageUrl: 'data:image/webp;base64,YWJj' };

function fixture(existing = [], savedListings = []) {
  let accounts = existing;
  let listings = savedListings;
  const storage = new Map();
  const context = {
    fallbackProducts: [['Notebook', 'Stationery']],
    normaliseEmail: value => value.trim().toLowerCase(),
    readAccounts: () => accounts,
    readSellerProducts: () => listings,
    writeAccounts: value => { accounts = value; },
    writeSellerProducts: value => { listings = value; return true; },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    ACCOUNT_STORE: 'accounts', SELLER_PRODUCT_STORE: 'listings',
  };
  const definitions = source('validateAccountTransfer') + '\n' + source('saveTransferredAccounts');
  vm.runInNewContext(definitions, context);
  return { context, accounts: () => accounts, listings: () => listings };
}

test('transfer keeps credentials, account types and seller listings', () => {
  const { context, accounts, listings } = fixture();
  const payload = { version: 1, users: [user('buyer@example.test'), user('seller@example.test', 'seller')], listings: [listing] };
  const result = context.saveTransferredAccounts(payload);
  assert.equal(result.added, 2);
  assert.equal(accounts()[0].verifier, payload.users[0].verifier);
  assert.equal(accounts()[1].role, 'seller');
  assert.equal(listings()[0].imageUrl, listing.imageUrl);
  assert.equal(payload.users.length, 2, 'source data remains unchanged');
});

test('transfer preserves existing accounts and does not import listings for conflicting credentials', () => {
  const existing = { ...user('seller@example.test', 'seller'), verifier: 'c'.repeat(64) };
  const { context, accounts, listings } = fixture([existing]);
  const result = context.saveTransferredAccounts({ version: 1, users: [user('seller@example.test', 'seller'), user('buyer@example.test')], listings: [listing] });
  assert.equal(result.added, 1);
  assert.equal(accounts()[0], existing);
  assert.equal(accounts()[0].verifier, 'c'.repeat(64));
  assert.equal(listings().length, 0);
});

test('invalid transfers do not change saved data', () => {
  const { context, accounts } = fixture();
  assert.throws(() => context.saveTransferredAccounts({ version: 1, users: [{ ...user('buyer@example.test'), verifier: 'plaintext' }], listings: [] }), /invalid/);
  assert.equal(accounts().length, 0);
  assert.throws(() => context.saveTransferredAccounts({ version: 1, users: [user('seller@example.test', 'seller')], listings: [{ ...listing, imageUrl: 'javascript:alert(1)' }] }), /listing/);
});

test('transfer receiver only accepts the original file window and matching token', () => {
  const token = 'a'.repeat(32);
  let listener;
  let saves = 0;
  const messages = [];
  const opener = { postMessage: (...args) => messages.push(args) };
  const elements = { resetEmail: {}, accountStatus: {} };
  const context = {
    URLSearchParams,
    window: {
      location: { search: '?page=account&transfer=' + token, origin: 'http://127.0.0.1:4176' },
      opener, addEventListener: (_name, handler) => { listener = handler; }, removeEventListener() {},
    },
    saveTransferredAccounts: () => { saves++; return { added: 1, email: 'buyer@example.test' }; },
    mergeSellerProducts() {}, setAccountMode() {},
    document: { getElementById: id => elements[id] },
    accountError: message => { throw new Error(message); },
    history: { replaceState() {} },
  };
  vm.runInNewContext(source('receiveFilePreviewAccounts') + '\nreceiveFilePreviewAccounts();', context);
  assert.equal(messages[0][0].type, 'unibasket-transfer-ready');
  const data = { type: 'unibasket-account-transfer', token, payload: {} };
  listener({ source: {}, origin: 'null', data });
  listener({ source: opener, origin: 'https://example.test', data });
  listener({ source: opener, origin: 'null', data: { ...data, token: 'wrong' } });
  assert.equal(saves, 0);
  listener({ source: opener, origin: 'null', data });
  assert.equal(saves, 1);
  assert.equal(elements.resetEmail.value, 'buyer@example.test');
});
