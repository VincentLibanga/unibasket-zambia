import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import test from 'node:test';

import express from 'express';

import { buildOrderReceipt, MailError } from '../mail.js';
import { createOrderService } from '../orders.js';
import { createOrdersRouter } from '../routes/orders.js';

const input = {
  idempotencyKey: randomUUID(), name: 'Vince Buyer', email: 'buyer@example.test',
  deliveryMethod: 'campus', deliveryNote: 'Main campus',
  items: [{ name: 'Notebook', price: 65, quantity: 1 }],
};
function fixture(overrides = {}) {
  const receipts = [];
  const service = createOrderService({
    sendReceipt: async receipt => { receipts.push(receipt); },
    now: () => Date.parse('2026-11-05T08:00:00Z'),
    ...overrides,
  });
  return { service, receipts };
}

test('checkout sends the buyer an unpaid order receipt without gateway credentials or a phone', async () => {
  const { service, receipts } = fixture();
  const result = await service.place({ ...input, paymentStatus: 'paid', outcome: 'SUCCESS', total: 1 });
  assert.equal(result.status, 'confirmed');
  assert.equal(result.paymentStatus, 'unpaid');
  assert.equal(result.emailSent, true);
  assert.equal(result.total, 90);
  assert.match(result.orderId, /^UBZ-[A-F0-9]{32}$/);
  assert.equal(result.createdAt, '2026-11-05T08:00:00.000Z');
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].email, input.email);
  assert.equal(receipts[0].name, input.name);
  assert.deepEqual(receipts[0].lines, [{ name: 'Notebook', price: 65, quantity: 1, lineTotal: 65 }]);
  assert.equal(receipts[0].paymentStatus, 'unpaid');
  assert.equal('paymentRef' in receipts[0], false);
  assert.equal('idempotencyKey' in receipts[0], false);
});

test('delivery prices and order totals use server charges and whole cents', async () => {
  for (const [deliveryMethod, charge] of [['campus', 25], ['pickup', 0], ['courier', 50]]) {
    const { service } = fixture();
    const result = await service.place({ ...input, deliveryMethod, deliveryCharge: -100, items: [{ name: 'Pen', price: 0.1, quantity: 3 }] });
    assert.equal(result.subtotal, 0.3);
    assert.equal(result.deliveryCharge, charge);
    assert.equal(result.total, charge + 0.3);
  }
});

test('invalid order details never trigger an email', async () => {
  const { service, receipts } = fixture();
  for (const change of [
    { email: 'bad-address' }, { email: 'buyer@example.test\r\nBcc: other@example.test' },
    { name: 'A' }, { deliveryMethod: 'other' }, { deliveryNote: '' }, { deliveryNote: 'x'.repeat(201) },
    { items: [] }, { items: [{ name: 'Pen', price: 0.001, quantity: 1 }] },
    { items: [{ name: 'Pen', price: 10, quantity: -1 }] },
    { idempotencyKey: undefined }, { idempotencyKey: 'invalid' },
  ]) {
    await assert.rejects(service.place({ ...input, ...change }), { code: 'INVALID_ORDER_DETAILS' });
  }
  assert.equal(receipts.length, 0);
});

test('concurrent and repeated checkout requests share one receipt and order reference', async () => {
  let release;
  let emails = 0;
  const { service } = fixture({ sendReceipt: async () => {
    emails++;
    await new Promise(resolve => { release = resolve; });
  } });
  const first = service.place(input);
  const second = service.place(input);
  assert.equal(emails, 1);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.deepEqual(a, b);
  assert.deepEqual(await service.place(input), a);
  assert.equal(emails, 1);
});

test('an idempotency key cannot be reused for another buyer or altered order', async () => {
  const { service, receipts } = fixture();
  await service.place(input);
  for (const change of [{ email: 'other@example.test' }, { deliveryMethod: 'courier' }, { items: [{ name: 'Notebook', price: 65, quantity: 2 }] }]) {
    await assert.rejects(service.place({ ...input, ...change }), { code: 'ORDER_CONFLICT', status: 409 });
  }
  assert.equal(receipts.length, 1);
});

test('an email failure does not confirm the order and an explicit retry keeps its reference', async () => {
  const references = [];
  const { service } = fixture({ sendReceipt: async receipt => {
    references.push(receipt.orderId);
    if (references.length === 1) throw new MailError('MAIL_AUTH_FAILED', 'SMTP login failed.');
  } });
  await assert.rejects(service.place(input), { code: 'MAIL_AUTH_FAILED' });
  const result = await service.place(input);
  assert.equal(result.status, 'confirmed');
  assert.equal(result.orderId, references[0]);
  assert.deepEqual(references, [result.orderId, result.orderId]);
  await service.place(input);
  assert.equal(references.length, 2);
});

test('an order receipt contains itemized amounts and explicitly identifies an unpaid order', async () => {
  const { service, receipts } = fixture();
  const result = await service.place({ ...input, name: 'Vince <Buyer>', deliveryNote: '<script>alert(1)</script>', items: [{ name: 'Pen & paper', price: 12.34, quantity: 2 }] });
  const message = buildOrderReceipt(receipts[0]);
  assert.equal(message.to, input.email);
  assert.ok(message.subject.includes(result.orderId));
  assert.match(message.text, /2 x Pen & paper — ZMW 24\.68/);
  assert.match(message.text, /Order total: ZMW 49\.68/);
  assert.match(message.text, /Payment status: Unpaid\. No payment was collected\./);
  assert.match(message.text, /05\/11\/2026, 10:00:00/);
  assert.match(message.html, /Vince &lt;Buyer&gt;/);
  assert.match(message.html, /Pen &amp; paper/);
  assert.doesNotMatch(message.html, /<script>/);
  assert.doesNotMatch(message.text + message.html, /Total paid|payment was successful|Payment reference|Paid with/i);
});

test('the order API confirms delivery, returns mail failures, and has no payment endpoints', async t => {
  let failMail = false;
  const { service, receipts } = fixture({ sendReceipt: async receipt => {
    if (failMail) throw new MailError('MAIL_UNREACHABLE', 'SMTP could not be reached.');
    receipts.push(receipt);
  } });
  const app = express();
  app.use(express.json());
  app.use('/api/orders', createOrdersRouter({ service }));
  const server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const response = await post('/api/orders', input);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = (await response.json()).data;
  assert.equal(result.paymentStatus, 'unpaid');
  assert.equal((await (await post('/api/orders', input)).json()).data.orderId, result.orderId);
  assert.equal(receipts.length, 1);
  assert.equal((await post('/api/orders', {})).status, 400);
  failMail = true;
  const failed = await post('/api/orders', { ...input, idempotencyKey: randomUUID() });
  assert.equal(failed.status, 503);
  assert.equal((await failed.json()).error.code, 'MAIL_UNREACHABLE');
  assert.equal((await post('/api/payments/initiate', {})).status, 404);
  assert.equal((await post('/api/payments/callback', {})).status, 404);
});
