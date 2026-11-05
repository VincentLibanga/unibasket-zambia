import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import { setupDatabase } from '../database/setup.js';
import { buildOrderReceipt } from '../mail.js';
import { createZynlepayGateway, paymentConfig, PaymentError } from '../payment-gateway.js';
import { createPaymentStore } from '../payment-store.js';
import { createPaymentService } from '../payments.js';
import { createPaymentsRouter } from '../routes/payments.js';

const env = { PAYMENT_MODE: 'test', ZYNLEPAY_SANDBOX_MERCHANT_CODE: 'MEC-TEST',
  ZYNLEPAY_SANDBOX_API_ID: 'test-api-id', ZYNLEPAY_SANDBOX_API_KEY: 'test-secret' };
const input = () => ({ idempotencyKey: randomUUID(), name: 'Vince Buyer', email: 'buyer@example.test', phone: '097 000 0000',
  deliveryMethod: 'campus', deliveryNote: 'Main campus', items: [{ id: 1, quantity: 1 }] });

test('payment configuration is sandbox-only and requires ZynlePay credentials', () => {
  assert.equal(paymentConfig({ ...env, PAYMENT_MODE: undefined }).mode, 'test');
  for (const key of ['ZYNLEPAY_SANDBOX_MERCHANT_CODE', 'ZYNLEPAY_SANDBOX_API_ID', 'ZYNLEPAY_SANDBOX_API_KEY']) {
    assert.throws(() => paymentConfig({ ...env, [key]: '' }), { code: 'PAYMENT_NOT_CONFIGURED' });
  }
  for (const change of [{ PAYMENT_MODE: 'live' }, { ZYNLEPAY_SANDBOX_API_URL: 'https://evil.example' }]) {
    assert.throws(() => paymentConfig({ ...env, ...change }), { code: 'PAYMENT_ENVIRONMENT_INVALID' });
  }
});

test('ZynlePay gateway uses the restored initiation and status contracts without assuming paid', async () => {
  const calls = [];
  const gateway = createZynlepayGateway({ env: () => env, fetcher: async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ response_code: calls.length === 1 ? '120' : '995',
      reference_no: 'UBP-EXAMPLE', transaction_id: 123456 }) };
  } });
  const order = { reference: 'UBP-EXAMPLE', amount_cents: '9000', details: input() };
  const initiated = await gateway.initiate(order);
  assert.equal(initiated.status, 'pending');
  assert.equal(initiated.transactionId, '123456');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(calls[0].url, 'https://sandbox.zynlepay.com/zynlepay/jsonapi');
  assert.equal(body.data.sender_id, '260970000000');
  assert.equal(body.data.amount, '90.00');
  const checked = await gateway.verify(order);
  assert.equal(calls[1].url, 'https://sandbox.zynlepay.com/zynlepay/jsonapi/paymentstatus');
  assert.equal(checked.status, 'pending');
  assert.equal(checked.confirmationAvailable, false);
  assert.equal(checked.gatewayCode, '995');
});

test('arbitrary status messages never establish successful payment and provider errors do not leak', async () => {
  const order = { reference: 'UBP-EXAMPLE', amount_cents: 9000, details: input() };
  const gateway = createZynlepayGateway({ env: () => env, fetcher: async () => ({ ok: true,
    json: async () => ({ response_code: '100', reference_no: order.reference, status: 'successful', message: 'Paid' }) }) });
  assert.equal((await gateway.verify(order)).status, 'pending');
  const offline = createZynlepayGateway({ env: () => env, fetcher: async () => { throw new Error('secret provider output'); } });
  await assert.rejects(offline.verify(order), error => error.code === 'PAYMENT_UNREACHABLE' && !error.message.includes('secret provider output'));
});

test('durable ZynlePay sandbox checkout and verification', async t => {
  const database = new PGlite();
  t.after(() => database.close());
  await setupDatabase({ query: sql => database.exec(sql) });
  const query = (sql, parameters) => database.query(sql, parameters);
  const store = createPaymentStore({ query });
  const transactions = new Map();
  const receipts = [];
  let started = 0;
  let transactionId = 1000;
  let failMail = false;
  let failProvider = false;
  const gateway = {
    config: () => paymentConfig(env),
    initiate: async order => {
      started++;
      if (failProvider) throw new PaymentError('PAYMENT_PROVIDER_UNAVAILABLE', 'Provider unavailable', 503);
      return { reference: order.reference, status: 'pending', confirmationAvailable: false, gatewayCode: '120' };
    },
    verify: async order => transactions.get(order.reference) || null,
  };
  const sendReceipt = async receipt => { if (failMail) throw new Error('SMTP unavailable'); receipts.push(receipt); };
  const service = createPaymentService({ store, gateway, sendReceipt });
  const success = (reference, changes = {}) => ({ transactionId: ++transactionId, reference,
    amount: 90, currency: 'ZMW', status: 'successful', confirmationAvailable: true, ...changes });

  await t.test('client prices are ignored, duplicate requests share one checkout, and records survive service recreation', async () => {
    const request = input();
    const before = started;
    const [first, second] = await Promise.all([service.initiate({ ...request, total: 1, items: [{ id: 1, quantity: 1, price: 0.01 }] }), service.initiate(request)]);
    assert.equal(first.reference, second.reference);
    assert.equal(started - before, 1);
    assert.equal(first.total, 90);
    assert.equal(first.paymentStatus, 'pending');
    assert.equal('request_hash' in first, false);
    const restarted = createPaymentService({ store, gateway, sendReceipt });
    assert.equal((await restarted.initiate(request)).reference, first.reference);
    await assert.rejects(restarted.initiate({ ...request, deliveryMethod: 'courier' }), { code: 'PAYMENT_CONFLICT' });
    await assert.rejects(restarted.verify(first.reference, randomUUID()), { code: 'PAYMENT_NOT_FOUND' });
    await assert.rejects(restarted.verify(first.reference, undefined), { code: 'INVALID_PAYMENT_KEY' });
    assert.equal((await restarted.verify(first.reference, request.idempotencyKey)).paymentStatus, 'pending');
  });

  await t.test('unknown products, seller-only products, excess stock and merged quantities cannot be charged', async () => {
    for (const items of [[{ id: 99999, quantity: 1 }], [{ id: 'seller-1', quantity: 1 }],
      [{ id: 1, quantity: 99 }], [{ id: 1, quantity: 60 }, { id: 1, quantity: 60 }]]) {
      await assert.rejects(service.initiate({ ...input(), items }), error => ['PRODUCT_UNAVAILABLE', 'INVALID_PAYMENT_ITEMS'].includes(error.code));
    }
  });

  await t.test('verification rejects altered reference, currency, amount, transaction ID and unverified completion', async () => {
    const request = input();
    const order = await service.initiate(request);
    for (const change of [{ reference: 'another-order' }, { currency: 'USD' }, { amount: 1 }, { amount: 90.001 },
      { transactionId: 'invalid' }, { transactionId: 0 }, { confirmationAvailable: false }]) {
      transactions.set(order.reference, success(order.reference, change));
      await assert.rejects(service.verify(order.reference, request.idempotencyKey), { code: 'PAYMENT_MISMATCH' });
      assert.equal((await store.findByReference(order.reference)).payment_status, 'pending');
    }
  });

  await t.test('only verified terminal data can mark paid, concurrent checks send one receipt, and paid never downgrades', async () => {
    const request = input();
    const order = await service.initiate(request);
    assert.equal((await store.findByReference(order.reference)).payment_status, 'pending');
    transactions.set(order.reference, success(order.reference));
    const before = receipts.length;
    await Promise.all([service.verify(order.reference, request.idempotencyKey), service.verify(order.reference, request.idempotencyKey)]);
    const result = await service.verify(order.reference, request.idempotencyKey);
    assert.equal(result.paymentStatus, 'paid');
    assert.equal(result.emailSent, true);
    assert.equal(receipts.length - before, 1);
    transactions.set(order.reference, success(order.reference, { status: 'failed' }));
    assert.equal((await service.verify(order.reference, request.idempotencyKey)).paymentStatus, 'paid');
    const message = buildOrderReceipt(receipts.at(-1));
    assert.match(message.text, /Paid \(test\).*No real money/);
    assert.match(message.text, /Payment reference:/);
    assert.doesNotMatch(message.text, /Payment status: Unpaid/);
  });

  await t.test('mail failure preserves verified payment and checking again retries only the receipt', async () => {
    const request = input();
    const order = await service.initiate(request);
    transactions.set(order.reference, success(order.reference));
    failMail = true;
    const paid = await service.verify(order.reference, request.idempotencyKey);
    assert.equal(paid.paymentStatus, 'paid');
    assert.equal(paid.emailSent, false);
    failMail = false;
    assert.equal((await service.verify(order.reference, request.idempotencyKey)).emailSent, true);
  });

  await t.test('ambiguous initialization is retained and retries do not create another checkout', async () => {
    const request = input();
    failProvider = true;
    const before = started;
    const order = await service.initiate(request);
    failProvider = false;
    assert.equal(order.checkoutUrl, null);
    assert.equal(order.paymentStatus, 'pending');
    assert.equal((await service.initiate(request)).reference, order.reference);
    assert.equal(started - before, 1);
  });

  await t.test('failed and pending provider states never confirm a payment', async () => {
    const request = input();
    const order = await service.initiate(request);
    transactions.set(order.reference, success(order.reference, { status: 'pending' }));
    assert.equal((await service.verify(order.reference, request.idempotencyKey)).paymentStatus, 'pending');
    transactions.set(order.reference, success(order.reference, { status: 'failed' }));
    assert.equal((await service.verify(order.reference, request.idempotencyKey)).paymentStatus, 'failed');
  });

  await t.test('RLS protects private payment records', async () => {
    await database.exec('CREATE ROLE payment_reader; GRANT USAGE ON SCHEMA public TO payment_reader; GRANT SELECT ON public.payment_orders TO payment_reader; SET ROLE payment_reader;');
    try { assert.equal(Number((await query('SELECT COUNT(*) AS count FROM public.payment_orders')).rows[0].count), 0); }
    finally { await database.exec('RESET ROLE'); }
  });

  await t.test('HTTP endpoints authorize verification and do not trust browser status or callbacks', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/payments', createPaymentsRouter({ service }));
    const server = createServer(app);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    try {
      const base = `http://127.0.0.1:${server.address().port}/api/payments`;
      const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
      assert.equal((await (await fetch(base + '/config')).json()).data.available, true);
      const request = input();
      const response = await post('/initiate', request);
      assert.equal(response.status, 201);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const order = (await response.json()).data;
      assert.equal((await post('/' + order.reference + '/verify', {})).status, 400);
      transactions.set(order.reference, success(order.reference));
      const verified = await post('/' + order.reference + '/verify', { status: 'failed' }, { Authorization: 'Bearer ' + request.idempotencyKey });
      assert.equal((await verified.json()).data.paymentStatus, 'paid');
      assert.equal((await post('/webhook', { event: 'charge.completed' })).status, 404);
    } finally {
      await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    }
  });
});
