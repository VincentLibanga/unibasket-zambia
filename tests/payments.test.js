import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import { setupDatabase } from '../database/setup.js';
import { buildOrderReceipt } from '../mail.js';
import { createFlutterwaveGateway, paymentConfig, PaymentError, validCheckoutUrl } from '../payment-gateway.js';
import { createPaymentStore } from '../payment-store.js';
import { createPaymentService } from '../payments.js';
import { createPaymentsRouter } from '../routes/payments.js';

const env = { PAYMENT_MODE: 'test', FLW_SECRET_KEY: 'FLWSECK_TEST-example-X',
  FLW_WEBHOOK_SECRET: 'a-long-test-webhook-secret-for-tests', APP_URL: 'http://127.0.0.1:4176' };
const checkoutUrl = 'https://checkout.flutterwave.com/v3/hosted/pay/example';
const input = () => ({ idempotencyKey: randomUUID(), name: 'Vince Buyer', email: 'buyer@example.test',
  deliveryMethod: 'campus', deliveryNote: 'Main campus', items: [{ id: 1, quantity: 1 }] });

test('payment configuration defaults to test mode and keeps live credentials out of test mode', () => {
  assert.equal(paymentConfig({ ...env, PAYMENT_MODE: undefined }).mode, 'test');
  assert.equal(paymentConfig(env).redirectUrl, 'http://127.0.0.1:4176/?payment_return=1');
  for (const change of [{ FLW_SECRET_KEY: '' }, { FLW_SECRET_KEY: 'FLWSECK-live-X' },
    { PAYMENT_MODE: 'live' }, { PAYMENT_MODE: 'other' }, { FLW_WEBHOOK_SECRET: 'short' },
    { APP_URL: 'http://shop.example' }, { APP_URL: 'https://user:secret@example.test' }]) {
    assert.throws(() => paymentConfig({ ...env, ...change }), { code: 'PAYMENT_NOT_CONFIGURED' });
  }
  assert.equal(paymentConfig({ ...env, PAYMENT_MODE: 'live', FLW_SECRET_KEY: 'FLWSECK-example-X', APP_URL: 'https://shop.example' }).mode, 'live');
  for (const url of ['https://evil.example', 'https://checkout.flutterwave.com.evil.example',
    'http://checkout.flutterwave.com', 'https://user@checkout.flutterwave.com', 'https://checkout.flutterwave.com:8443']) {
    assert.equal(validCheckoutUrl(url), false);
  }
  assert.equal(validCheckoutUrl(checkoutUrl), true);
});

test('gateway creates ZMW hosted checkout and verifies through the official API without exposing secrets', async () => {
  const calls = [];
  const gateway = createFlutterwaveGateway({ env: () => env, fetcher: async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ status: 'success', data: options.method === 'POST' ? { link: checkoutUrl } : { status: 'successful' } }) };
  } });
  assert.equal(await gateway.initiate({ reference: 'UBP-EXAMPLE', amount_cents: '9000', details: input() }), checkoutUrl);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(calls[0].url, 'https://api.flutterwave.com/v3/payments');
  assert.equal(body.currency, 'ZMW');
  assert.equal(body.amount, '90.00');
  assert.equal(body.payment_options, 'card,mobilemoneyzambia');
  assert.equal('secretKey' in body, false);
  await gateway.verify('UBP-EXAMPLE');
  assert.match(calls[1].url, /verify_by_reference\?tx_ref=UBP-EXAMPLE$/);
  assert.equal(gateway.verifyWebhook(env.FLW_WEBHOOK_SECRET), true);
  assert.equal(gateway.verifyWebhook('forged'), false);
  assert.equal(gateway.verifyWebhook(undefined), false);
});

test('invalid provider links, malformed responses and network errors fail without leaking provider output', async () => {
  const order = { reference: 'UBP-EXAMPLE', amount_cents: 9000, details: input() };
  const invalid = createFlutterwaveGateway({ env: () => env, fetcher: async () => ({ ok: true, json: async () => ({ status: 'success', data: { link: 'https://evil.example' } }) }) });
  await assert.rejects(invalid.initiate(order), { code: 'INVALID_PAYMENT_LINK' });
  const offline = createFlutterwaveGateway({ env: () => env, fetcher: async () => { throw new Error('secret provider output'); } });
  await assert.rejects(offline.verify(order.reference), error => error.code === 'PAYMENT_PROVIDER_UNAVAILABLE' && !error.message.includes('secret provider output'));
  const rejected = createFlutterwaveGateway({ env: () => env, fetcher: async () => ({ ok: false, status: 401, json: async () => ({ message: 'private provider output' }) }) });
  await assert.rejects(rejected.initiate(order), { code: 'PAYMENT_REJECTED' });
});

test('durable payment checkout, verification and webhook handling', async t => {
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
    initiate: async () => {
      started++;
      if (failProvider) throw new PaymentError('PAYMENT_PROVIDER_UNAVAILABLE', 'Provider unavailable', 503);
      return checkoutUrl;
    },
    verify: async reference => transactions.get(reference) || null,
    verifyWebhook: header => header === env.FLW_WEBHOOK_SECRET,
  };
  const sendReceipt = async receipt => { if (failMail) throw new Error('SMTP unavailable'); receipts.push(receipt); };
  const service = createPaymentService({ store, gateway, sendReceipt });
  const success = (reference, changes = {}) => ({ id: ++transactionId, tx_ref: reference,
    amount: 90, currency: 'ZMW', status: 'successful', customer: { email: 'buyer@example.test' }, ...changes });

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

  await t.test('verification rejects altered reference, currency, amount, transaction ID and buyer', async () => {
    const request = input();
    const order = await service.initiate(request);
    for (const change of [{ tx_ref: 'another-order' }, { currency: 'USD' }, { amount: 1 }, { amount: 90.001 },
      { id: 'invalid' }, { id: 0 }, { customer: { email: 123 } }, { customer: { email: 'other@example.test' } }]) {
      transactions.set(order.reference, success(order.reference, change));
      await assert.rejects(service.verify(order.reference, request.idempotencyKey), { code: 'PAYMENT_MISMATCH' });
      assert.equal((await store.findByReference(order.reference)).payment_status, 'pending');
    }
  });

  await t.test('only provider verification can mark paid, repeated callbacks send one receipt, and paid never downgrades', async () => {
    const request = input();
    const order = await service.initiate(request);
    await assert.rejects(service.webhook('forged', { event: 'charge.completed', data: { tx_ref: order.reference, status: 'successful' } }), { code: 'INVALID_WEBHOOK' });
    await service.webhook(env.FLW_WEBHOOK_SECRET, { event: 'charge.completed', data: { tx_ref: order.reference, status: 'successful' } });
    assert.equal((await store.findByReference(order.reference)).payment_status, 'pending');
    transactions.set(order.reference, success(order.reference));
    const before = receipts.length;
    await Promise.all([service.verify(order.reference, request.idempotencyKey), service.webhook(env.FLW_WEBHOOK_SECRET, { event: 'charge.completed', data: { tx_ref: order.reference } })]);
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

  await t.test('HTTP endpoints initiate, authorize verification and authenticate webhooks', async () => {
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
      assert.equal((await post('/webhook', { event: 'charge.completed' })).status, 401);
      assert.equal((await post('/webhook', { event: 'irrelevant' }, { 'verif-hash': env.FLW_WEBHOOK_SECRET })).status, 200);
    } finally {
      await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    }
  });
});
