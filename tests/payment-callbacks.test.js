import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import express from 'express';

import { createPaymentService } from '../payments.js';
import { createPaymentsRouter } from '../routes/payments.js';
import { authenticateZynleCallback, getZynlePaymentStatus, parseZynlePaymentCallback, ZYNLEPAY_SANDBOX_URL } from '../zynlepay.js';

const input = {
  name: 'Test Buyer', email: 'buyer@example.test', phone: '097 000 0000',
  paymentMethod: 'mobile_money', deliveryMethod: 'campus',
  items: [{ name: 'Notebook', price: 65, quantity: 1 }],
};
const callback = (reference, changes = {}) => ({
  isAcknowledged: true, amount: '90.00', phone: '260970000000', operator: 'Airtel',
  response_code: '100', response_description: 'Transaction Successful',
  operator_reference: '12345678-abcd-4321-abcd-123456789abc',
  reference_no: reference, transaction_date: '2026-11-04', transaction_status: 'SUCCESS',
  merchant_callback_url: 'https://merchant.example/callback?token=private-test-value',
  transaction_result: { code: '100', message: 'Transaction processed successfully' },
  ...changes,
});
function fixture(overrides = {}) {
  const receipts = [];
  let submissions = 0;
  const service = createPaymentService({
    config: () => ({}), callbacksEnabled: () => true, getStatus: null,
    initiatePayment: async order => {
      submissions++;
      return { response_code: '120', reference_no: order.reference, transaction_id: 1234567890 };
    },
    sendReceipt: async receipt => { receipts.push(receipt); }, onMailError() {},
    ...overrides,
  });
  const checkout = service.create(input);
  return { service, checkout, receipts, submissions: () => submissions };
}

test('callback authentication requires its own configured secret', () => {
  const secret = 'a'.repeat(64);
  authenticateZynleCallback(secret, secret);
  for (const token of [undefined, null, '', 'b'.repeat(64), [secret]]) {
    assert.throws(() => authenticateZynleCallback(token, secret), { code: 'INVALID_PAYMENT_CALLBACK_AUTH', status: 401 });
  }
  assert.throws(() => authenticateZynleCallback(secret, ''), { code: 'PAYMENT_CALLBACK_NOT_CONFIGURED', status: 503 });
});

test('callback parsing requires consistent terminal fields and discards arbitrary metadata', () => {
  const result = parseZynlePaymentCallback(callback('UBZ-TEST'));
  assert.equal(result.status, 'successful');
  assert.equal(result.amount, '90.00');
  assert.equal(result.phone, '260970000000');
  assert.equal(result.merchant_callback_url, undefined);
  assert.equal(result.response_description, undefined);
  for (const response_code of ['120', '130']) {
    assert.throws(() => parseZynlePaymentCallback({ response_code, reference_no: 'UBZ-TEST' }), { code: 'INVALID_PAYMENT_CALLBACK' });
  }
  for (const change of [
    { isAcknowledged: false }, { transaction_status: 'PENDING' },
    { transaction_result: { code: '120' } }, { transaction_result: { code: '130' } },
    { transaction_result: { code: ['100'] } },
    { transaction_status: 'FAILED' }, { amount: null }, { amount: '90.001' },
    { amount: -90 }, { amount: true }, { phone: 'invalid' }, { phone: ['260970000000'] }, { currency: 'USD' },
    { operator_reference: '<script>' },
  ]) {
    assert.throws(() => parseZynlePaymentCallback(callback('UBZ-TEST', change)), { code: 'INVALID_PAYMENT_CALLBACK' });
  }
});

test('success callbacks acknowledge promptly and retries send one receipt', async () => {
  let releaseMail;
  let emails = 0;
  const { service, checkout, submissions } = fixture({ sendReceipt: async () => {
    emails++;
    await new Promise(resolve => { releaseMail = resolve; });
  } });
  await service.initiate(checkout.reference, checkout.token);
  const payload = callback(checkout.reference);
  const acknowledgement = { response_code: '130', reference_no: checkout.reference };
  assert.deepEqual(service.receiveCallback(payload), acknowledgement);
  assert.deepEqual(service.receiveCallback(payload), acknowledgement);
  assert.equal(emails, 1);
  releaseMail();
  const results = await Promise.all([
    service.verify(checkout.reference, checkout.token), service.verify(checkout.reference, checkout.token),
  ]);
  assert.equal(results[0].status, 'successful');
  assert.equal(results[0].paymentRef, '1234567890');
  assert.equal(results[0].total, 90);
  assert.deepEqual(service.receiveCallback(payload), acknowledgement);
  assert.equal(emails, 1);
  assert.equal(submissions(), 1);
});

test('failure callbacks are terminal, preserve the basket contract and send no receipt', async () => {
  const { service, checkout, receipts } = fixture();
  await service.initiate(checkout.reference, checkout.token);
  const payload = callback(checkout.reference, { transaction_status: 'FAILED', transaction_result: { code: '203' } });
  assert.equal(service.receiveCallback(payload).response_code, '130');
  assert.equal((await service.verify(checkout.reference, checkout.token)).status, 'failed');
  assert.equal(receipts.length, 0);
  assert.equal(service.receiveCallback(payload).response_code, '130');
  assert.throws(() => service.receiveCallback(callback(checkout.reference)), { code: 'PAYMENT_CALLBACK_CONFLICT' });
});

test('callbacks must match an initiated checkout, its amount and its phone', async () => {
  const { service, checkout, receipts } = fixture();
  assert.throws(() => service.receiveCallback(callback(checkout.reference)), { code: 'PAYMENT_NOT_INITIATED' });
  await service.initiate(checkout.reference, checkout.token);
  for (const change of [{ amount: '89.99' }, { phone: '260971111111' }]) {
    assert.throws(() => service.receiveCallback(callback(checkout.reference, change)), { code: 'PAYMENT_MISMATCH' });
  }
  assert.throws(() => service.receiveCallback(callback('UNKNOWN-REFERENCE')), { code: 'PAYMENT_NOT_FOUND' });
  assert.equal((await service.verify(checkout.reference, checkout.token)).status, 'pending');
  assert.equal(receipts.length, 0);
});

test('a callback can arrive before the initiation response without being overwritten', async () => {
  let releaseGateway;
  const { service, checkout, receipts } = fixture({ initiatePayment: () => new Promise(resolve => { releaseGateway = resolve; }) });
  const submitting = service.initiate(checkout.reference, checkout.token);
  service.receiveCallback(callback(checkout.reference));
  releaseGateway({ response_code: '120', reference_no: checkout.reference });
  assert.equal((await submitting).status, 'successful');
  assert.equal((await service.verify(checkout.reference, checkout.token)).status, 'successful');
  assert.equal(receipts.length, 1);
});

test('callbacks win over an in-flight pending or failed status query', async () => {
  for (const rejectQuery of [false, true]) {
    let resolveQuery, failQuery;
    const { service, checkout, receipts } = fixture({ getStatus: () => new Promise((resolve, reject) => {
      resolveQuery = resolve;
      failQuery = reject;
    }) });
    await service.initiate(checkout.reference, checkout.token);
    const verifying = service.verify(checkout.reference, checkout.token);
    service.receiveCallback(callback(checkout.reference));
    if (rejectQuery) failQuery(new Error('Status endpoint unavailable'));
    else resolveQuery({ reference: checkout.reference, status: 'pending', confirmationAvailable: false });
    assert.equal((await verifying).status, 'successful');
    assert.equal(receipts.length, 1);
  }
});

test('receipt email failure does not undo callback confirmation or cause a retry', async () => {
  let attempts = 0;
  const { service, checkout } = fixture({ sendReceipt: async () => { attempts++; throw new Error('SMTP unavailable'); } });
  await service.initiate(checkout.reference, checkout.token);
  service.receiveCallback(callback(checkout.reference));
  const paid = await service.verify(checkout.reference, checkout.token);
  assert.equal(paid.status, 'successful');
  assert.equal(paid.emailSent, false);
  service.receiveCallback(callback(checkout.reference));
  assert.equal(attempts, 1);
});

test('an authenticated status query can confirm a complete matching terminal payload', async () => {
  const { service, checkout, receipts } = fixture({ getStatus: order => getZynlePaymentStatus(order, {
    config: () => ({ apiId: 'test-id', apiKey: 'test-key', apiUrl: ZYNLEPAY_SANDBOX_URL }),
    fetchImpl: async (url, options) => {
      assert.equal(url, ZYNLEPAY_SANDBOX_URL + '/paymentstatus');
      assert.equal(JSON.parse(options.body).reference_no, order.reference);
      return { ok: true, json: async () => callback(order.reference) };
    },
  }) });
  await service.initiate(checkout.reference, checkout.token);
  assert.equal((await service.verify(checkout.reference, checkout.token)).status, 'successful');
  assert.equal(receipts.length, 1);
  await service.verify(checkout.reference, checkout.token);
  assert.equal(receipts.length, 1);
});

test('terminal status results with a mismatched phone cannot confirm an order', async () => {
  const { service, checkout, receipts } = fixture({ getStatus: async order => parseZynlePaymentCallback(callback(order.reference, { phone: '260971111111' })) });
  await service.initiate(checkout.reference, checkout.token);
  await assert.rejects(service.verify(checkout.reference, checkout.token), { code: 'PAYMENT_MISMATCH' });
  assert.equal(receipts.length, 0);
});

test('callback HTTP route authenticates before settlement and returns the supplied 130 acknowledgement', async t => {
  const { service, checkout, receipts } = fixture();
  await service.initiate(checkout.reference, checkout.token);
  const secret = 'a'.repeat(64);
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.use('/api/payments', createPaymentsRouter({ service, callbackSecret: () => secret }));
  app.use('/disabled', createPaymentsRouter({ service, callbackSecret: () => '' }));
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
  const send = (path, payload = callback(checkout.reference)) => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const unauthorized = await send('/api/payments/callback?token=' + 'b'.repeat(64));
  assert.equal(unauthorized.status, 401);
  assert.equal((await send('/api/payments/callback?token=' + checkout.token)).status, 401);
  assert.equal(receipts.length, 0);
  assert.equal((await service.verify(checkout.reference, checkout.token)).status, 'pending');
  const disabled = await send('/disabled/callback?token=' + secret);
  assert.equal(disabled.status, 503);
  const accepted = await send('/api/payments/callback?token=' + secret);
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { response_code: '130', reference_no: checkout.reference });
  assert.equal((await service.verify(checkout.reference, checkout.token)).status, 'successful');
  assert.equal(receipts.length, 1);
  const duplicate = await send('/api/payments/callback?token=' + secret);
  assert.equal(duplicate.status, 200);
  assert.equal(receipts.length, 1);
});
