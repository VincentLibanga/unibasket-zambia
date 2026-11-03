import assert from 'node:assert/strict';
import test from 'node:test';

import { createPaymentService } from '../payments.js';
import { PaymentError } from '../zynlepay.js';

const input = {
  name: 'Vince Buyer', email: 'buyer@example.test', phone: '097 000 0000',
  paymentMethod: 'mobile_money', deliveryMethod: 'campus', deliveryNote: 'Main campus',
  items: [{ name: 'Notebook', price: 65, quantity: 1 }],
};
const verifiedCollection = order => ({
  reference: order.reference, currency: 'ZMW', amount: '80.00', status: 'successful', transactionId: 'ZYNLEPAY-123',
});

function serviceWith(overrides = {}) {
  const receipts = [];
  const requests = [];
  const service = createPaymentService({
    config: () => ({ apiKey: 'test-secret' }),
    getStatus: null,
    initiatePayment: async order => { requests.push(order.reference); return { response_code: 'UNCONFIRMED-TEST', reference_no: order.reference }; },
    sendReceipt: async receipt => { receipts.push(receipt); }, onMailError: () => {},
    ...overrides,
  });
  return { service, receipts, requests };
}

async function started(service, details = input) {
  const checkout = service.create(details);
  await service.initiate(checkout.reference, checkout.token);
  return checkout;
}

test('checkout snapshots total and saves a reference before any gateway submission', () => {
  const { service, requests, receipts } = serviceWith();
  const checkout = service.create(input);
  assert.equal(checkout.amount, 80);
  assert.equal(checkout.currency, 'ZMW');
  assert.equal(checkout.status, 'created');
  assert.match(checkout.reference, /^UBZ-[A-F0-9]{32}$/);
  assert.equal(JSON.stringify(checkout).includes('test-secret'), false);
  assert.equal(requests.length, 0);
  assert.equal(receipts.length, 0);
});

test('totals use whole cents and server delivery charges', () => {
  const { service } = serviceWith();
  const checkout = service.create({ ...input, deliveryMethod: 'courier', items: [{ name: 'Pen', price: 0.1, quantity: 3 }] });
  assert.equal(checkout.amount, 30.3);
  assert.throws(() => service.create({ ...input, items: [{ name: 'Pen', price: 0.001, quantity: 1 }] }), { code: 'INVALID_PAYMENT_DETAILS' });
  assert.throws(() => service.create({ ...input, items: [{ name: 'Pen', price: 10, quantity: -1 }] }), { code: 'INVALID_PAYMENT_DETAILS' });
  assert.throws(() => service.create({ ...input, paymentMethod: 'card' }), { code: 'INVALID_PAYMENT_DETAILS' });
});

test('HTTP acceptance and client outcome flags cannot approve an unverified checkout', async () => {
  const { service, receipts } = serviceWith();
  const checkout = await started(service, { ...input, outcome: 'SUCCESS' });
  assert.deepEqual(await service.verify(checkout.reference, checkout.token), { status: 'pending', confirmationAvailable: false });
  assert.equal(receipts.length, 0);
});

test('observed ZynlePay response 120 records its transaction ID and remains pending', async () => {
  const { service, receipts } = serviceWith({ initiatePayment: async order => ({
    response_code: '120', response_description: 'Transaction is initiated', reference_no: order.reference,
    transaction_id: 1234567890, operator: 'airtel',
  }) });
  const checkout = await started(service);
  assert.deepEqual(await service.verify(checkout.reference, checkout.token), {
    status: 'pending', confirmationAvailable: false, gatewayCode: '120', paymentRef: '1234567890',
  });
  assert.equal(receipts.length, 0);
});

test('arbitrary provider values are not exposed as transaction IDs', async () => {
  const { service } = serviceWith({ initiatePayment: async order => ({
    response_code: '120', reference_no: order.reference, transaction_id: 'test-secret',
  }) });
  const checkout = await started(service);
  const result = await service.verify(checkout.reference, checkout.token);
  assert.equal(result.status, 'pending');
  assert.equal(result.paymentRef, undefined);
});

test('initiation and verification require the private checkout token', async () => {
  const { service, requests } = serviceWith();
  const checkout = service.create(input);
  await assert.rejects(service.initiate(checkout.reference, '0'.repeat(64)), { code: 'PAYMENT_NOT_FOUND' });
  await assert.rejects(service.verify(checkout.reference, null), { code: 'PAYMENT_NOT_FOUND' });
  assert.equal(requests.length, 0);
});

test('duplicate and concurrent initiation requests submit one gateway charge', async () => {
  const { service, requests } = serviceWith();
  const checkout = service.create(input);
  const results = await Promise.all([
    service.initiate(checkout.reference, checkout.token),
    service.initiate(checkout.reference, checkout.token),
  ]);
  await service.initiate(checkout.reference, checkout.token);
  assert.equal(requests.length, 1);
  assert.equal(results[0].status, 'pending');
});

test('timeout never resubmits a possibly accepted payment', async () => {
  let requests = 0;
  const { service } = serviceWith({ initiatePayment: async () => { requests++; throw new PaymentError('PAYMENT_UNREACHABLE', 'Timeout', 503); } });
  const checkout = service.create(input);
  await assert.rejects(service.initiate(checkout.reference, checkout.token), { code: 'PAYMENT_UNREACHABLE' });
  assert.equal((await service.initiate(checkout.reference, checkout.token)).status, 'pending');
  assert.equal((await service.verify(checkout.reference, checkout.token)).status, 'pending');
  assert.equal(requests, 1);
});

test('definite authentication or simulator failures are retained without a receipt', async () => {
  for (const code of ['PAYMENT_AUTH_FAILED', 'SIMULATOR_NOT_CONFIGURED']) {
    const { service, receipts } = serviceWith({ initiatePayment: async () => { throw new PaymentError(code, 'Rejected', 422, { definite: true }); } });
    const checkout = service.create(input);
    const result = await service.initiate(checkout.reference, checkout.token);
    assert.equal(result.status, 'failed');
    assert.equal(result.code, code);
    assert.deepEqual(await service.verify(checkout.reference, checkout.token), result);
    assert.equal(receipts.length, 0);
  }
});

test('reference, currency and amount must match before confirming payment', async () => {
  for (const change of [{ reference: 'another-order' }, { currency: 'USD' }, { amount: '79.99' }, { amount: null }]) {
    const { service, receipts } = serviceWith({ getStatus: async order => ({ ...verifiedCollection(order), ...change }) });
    const checkout = await started(service);
    await assert.rejects(service.verify(checkout.reference, checkout.token), { code: 'PAYMENT_MISMATCH' });
    assert.equal(receipts.length, 0);
  }
});

test('pending and failed verified status never sends a receipt', async () => {
  for (const status of ['pending', 'failed']) {
    const { service, receipts } = serviceWith({ getStatus: async order => ({ ...verifiedCollection(order), status }) });
    const checkout = await started(service);
    assert.equal((await service.verify(checkout.reference, checkout.token)).status, status);
    assert.equal(receipts.length, 0);
  }
});

test('a future verified status adapter can confirm a pending payment exactly once', async () => {
  let status = 'pending';
  const { service, receipts } = serviceWith({ getStatus: async order => ({ ...verifiedCollection(order), status }) });
  const checkout = await started(service);
  assert.equal((await service.verify(checkout.reference, checkout.token)).status, 'pending');
  status = 'successful';
  const results = await Promise.all([
    service.verify(checkout.reference, checkout.token), service.verify(checkout.reference, checkout.token),
  ]);
  assert.equal(results[0].status, 'successful');
  assert.equal(results[0].paymentMethod, 'Mobile money via ZynlePay');
  assert.equal(receipts.length, 1);
  await service.verify(checkout.reference, checkout.token);
  assert.equal(receipts.length, 1);
});

test('receipt email failure does not undo a verified payment or cause repeated sending', async () => {
  let emails = 0;
  const { service } = serviceWith({ getStatus: async order => verifiedCollection(order), sendReceipt: async () => { emails++; throw new Error('SMTP down'); } });
  const checkout = await started(service);
  const paid = await service.verify(checkout.reference, checkout.token);
  assert.equal(paid.status, 'successful');
  assert.equal(paid.emailSent, false);
  await service.verify(checkout.reference, checkout.token);
  assert.equal(emails, 1);
});

test('test checkout expires after 24 hours', async () => {
  let clock = Date.now();
  const { service } = serviceWith({ now: () => clock });
  const checkout = service.create(input);
  clock += 24 * 60 * 60 * 1000 + 1;
  await assert.rejects(service.verify(checkout.reference, checkout.token), { code: 'PAYMENT_NOT_FOUND' });
});
