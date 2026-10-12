import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const script = await readFile(new URL('../public/script.js', import.meta.url), 'utf8');
function runFunction(name, context, call) {
  const start = script.search(new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`));
  assert.ok(start >= 0);
  const end = script.indexOf('\n}\n', start);
  return vm.runInNewContext(`${script.slice(start, end + 2)}\n${call}`, context);
}
const product = (id, stock = 25) => ['Product', 'Category', 65, '', '', '', '', id, stock];

test('basket follows product IDs when catalogue order changes', () => {
  const previousProducts = [product(1), product(2)];
  const nextProducts = [product('seller-new'), product(2), product(1)];
  const result = runFunction('remapCart', { previousProducts, nextProducts },
    'remapCart([{ i: 0, q: 2 }], previousProducts, nextProducts)');
  assert.equal(JSON.stringify(result), JSON.stringify([{ i: 2, q: 2 }]));
});

test('basket removes deleted products and limits quantities to available stock', () => {
  const previousProducts = [product(1), product(2), product(3)];
  const nextProducts = [product(1, 2), product(3, 0)];
  const result = runFunction('remapCart', { previousProducts, nextProducts },
    'remapCart([{ i: 0, q: 5 }, { i: 1, q: 1 }, { i: 2, q: 1 }], previousProducts, nextProducts)');
  assert.equal(JSON.stringify(result), JSON.stringify([{ i: 0, q: 2 }]));
});

test('adding a product cannot exceed stock or the checkout quantity limit', () => {
  for (const [stock, quantity] of [[0, 0], [2, 2], [200, 99]]) {
    const cart = quantity ? [{ i: 0, q: quantity }] : [];
    let message;
    runFunction('add', {
      products: [product(1, stock)], cart, showToast: value => { message = value; },
      document: { getElementById: () => { throw new Error('Basket should stay unchanged'); } },
    }, 'add(0)');
    assert.equal(cart[0]?.q || 0, quantity);
    assert.match(message, /available quantity/);
  }
});
