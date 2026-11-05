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

function basketFixture({ lines = [{ i: 0, q: 1 }], stock = 25, pendingOrder = null } = {}) {
  const elements = Object.fromEntries(['count', 'cartButton', 'basketItemCount', 'basketTotalLabel', 'subtotal',
    'basketFooter', 'basketCheckout', 'basketDeliveryNote', 'basketLines', 'basketClose', 'basketModal'].map(id => [id, {
      id, textContent: '', innerHTML: '', hidden: id === 'basketModal', attributes: {}, isConnected: true,
      setAttribute(name, value) { this.attributes[name] = value; },
      focus() { document.activeElement = this; }, getClientRects: () => [{}],
    }]));
  const classes = new Set();
  const surroundings = [{ inert: false }, { inert: false }, { inert: false }];
  const controls = [elements.basketClose, elements.basketCheckout];
  const document = {
    getElementById: id => elements[id], activeElement: elements.cartButton,
    body: { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } },
    querySelector: () => null,
    querySelectorAll: selector => selector.startsWith('body >') ? surroundings : controls,
  };
  const historyCalls = [];
  const context = {
    document, cart: lines, products: [product(1, stock), product(2)], pendingOrder, basketReturnFocus: null,
    cataloguePhoto: () => 'images/products/product-01.jpg',
    showToast: message => { context.toast = message; },
    window: { location: { search: '?page=basket' } }, URLSearchParams,
    history: { replaceState: (...args) => historyCalls.push(args) }, applyRoute() {},
  };
  const functions = ['updateCartBadge', 'renderBasket', 'changeQty', 'removeCartItem', 'escapeHtml',
    'openBasket', 'closeBasket', 'handleBasketKeydown'].map(name => {
    const start = script.search(new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`));
    return script.slice(start, script.indexOf('\n}\n', start) + 2);
  }).join('\n');
  vm.createContext(context);
  vm.runInContext(functions, context);
  return { context, elements, surroundings, historyCalls, classes,
    run: call => vm.runInContext(call, context) };
}

test('basket quantities update totals and accessible counts without exceeding stock', () => {
  const { run, context, elements } = basketFixture({ stock: 2 });
  run('renderBasket(); changeQty(0, 1);');
  assert.equal(context.cart[0].q, 2);
  assert.equal(elements.subtotal.textContent, 'ZMW 130.00');
  assert.equal(elements.basketItemCount.textContent, '2 items');
  assert.equal(elements.cartButton.attributes['aria-label'], 'Open basket, 2 items');
  assert.match(elements.basketLines.innerHTML, /id="basketIncrease-0"[^>]* disabled/);
  run('changeQty(0, 1)');
  assert.equal(context.cart[0].q, 2);
  assert.match(context.toast, /available quantity/);
});

test('removing the last basket item shows the empty state and disables checkout', () => {
  const { run, context, elements } = basketFixture();
  run('removeCartItem(0)');
  assert.equal(context.cart.length, 0);
  assert.equal(elements.count.textContent, '0');
  assert.equal(elements.basketFooter.hidden, true);
  assert.equal(elements.basketCheckout.disabled, true);
  assert.match(elements.basketLines.innerHTML, /Your basket is empty/);
  assert.match(elements.basketLines.innerHTML, /Browse products/);
});

test('a saved order remains reachable from an empty basket after reload', () => {
  const { run, elements } = basketFixture({ lines: [], pendingOrder: { amount: 90 } });
  run('renderBasket()');
  assert.equal(elements.basketFooter.hidden, false);
  assert.equal(elements.basketCheckout.disabled, false);
  assert.equal(elements.basketTotalLabel.textContent, 'Saved order total');
  assert.equal(elements.subtotal.textContent, 'ZMW 90.00');
  assert.match(elements.basketCheckout.innerHTML, /Resume order confirmation/);
});

test('the compact basket badge keeps the full item count available to screen readers', () => {
  const { run, elements } = basketFixture({ lines: [{ i: 0, q: 99 }, { i: 1, q: 2 }] });
  run('updateCartBadge()');
  assert.equal(elements.count.textContent, '99+');
  assert.equal(elements.cartButton.attributes['aria-label'], 'Open basket, 101 items');
});

test('Escape closes the basket, restores background interaction and returns focus', () => {
  const { run, context, elements, surroundings, historyCalls, classes } = basketFixture();
  run('openBasket()');
  assert.equal(elements.basketModal.hidden, false);
  assert.ok(surroundings.every(node => node.inert));
  assert.equal(context.document.activeElement, elements.basketClose);
  run('handleBasketKeydown({ key: "Escape", preventDefault() {} })');
  assert.equal(elements.basketModal.hidden, true);
  assert.ok(surroundings.every(node => !node.inert));
  assert.equal(classes.has('shopping-open'), false);
  assert.equal(context.document.activeElement, elements.cartButton);
  assert.equal(historyCalls[0][2], './');
});

test('Tab and Shift+Tab keep keyboard focus inside the open basket', () => {
  const { run, context, elements } = basketFixture();
  context.document.activeElement = elements.basketCheckout;
  run('handleBasketKeydown({ key: "Tab", shiftKey: false, preventDefault() {} })');
  assert.equal(context.document.activeElement, elements.basketClose);
  run('handleBasketKeydown({ key: "Tab", shiftKey: true, preventDefault() {} })');
  assert.equal(context.document.activeElement, elements.basketCheckout);
});
