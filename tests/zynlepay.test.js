import assert from 'node:assert/strict';
import test from 'node:test';

import { initiateZynlePayment, normalizeMobileNumber, requestZynlePay, ZYNLEPAY_SANDBOX_URL } from '../zynlepay.js';

const config = () => ({ merchantId: 'MEC-TEST', apiId: 'test-id', apiKey: 'test-secret', apiUrl: ZYNLEPAY_SANDBOX_URL });
const order = { reference: 'UBZ-TEST', phone: '097 000 0000', total: 80 };

test('Zambian mobile numbers normalize to the sender_id format', () => {
  for (const phone of ['097 000 0000', '+260970000000', '260970000000']) assert.equal(normalizeMobileNumber(phone), '260970000000');
  assert.throws(() => normalizeMobileNumber('not-a-number'), { code: 'INVALID_PAYMENT_DETAILS' });
  assert.throws(() => normalizeMobileNumber('233240000000'), { code: 'INVALID_PAYMENT_DETAILS' });
});

test('mobile money request uses the supplied ZynlePay JSON contract', async () => {
  const result = await initiateZynlePayment(order, { config, fetchImpl: async (url, options) => {
    assert.equal(url, ZYNLEPAY_SANDBOX_URL);
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), {
      auth: { merchant_id: 'MEC-TEST', api_id: 'test-id', api_key: 'test-secret', channel: 'momo' },
      data: { method: 'runBillPayment', sender_id: '260970000000', reference_no: 'UBZ-TEST', amount: '80.00' },
    });
    return { ok: true, json: async () => ({ response_code: 'PENDING-TEST', reference_no: 'UBZ-TEST' }) };
  } });
  assert.equal(result.response_code, 'PENDING-TEST');
});

test('missing simulator response is a definite failure with clear feedback', async () => {
  await assert.rejects(initiateZynlePayment(order, { config, fetchImpl: async () => ({
    ok: true, json: async () => ({ response_code: '2000', reference_no: 'UBZ-TEST', response_description: 'test-secret' }),
  }) }), error => error.code === 'SIMULATOR_NOT_CONFIGURED' && error.definite && !error.message.includes('test-secret'));
});

test('authentication failure is handled before its placeholder reference', async () => {
  await assert.rejects(initiateZynlePayment(order, { config, fetchImpl: async () => ({
    ok: true, json: async () => ({ response_code: '9902', reference_no: '00000000', response_description: 'Wrong API credentials' }),
  }) }), error => error.code === 'PAYMENT_AUTH_FAILED' && error.definite && !error.message.includes('test-secret'));
});

test('the observed transaction-initiated response is returned without claiming payment completion', async () => {
  const response = { response_code: '120', reference_no: 'UBZ-TEST', transaction_id: 1234567890, response_description: 'Transaction is initiated' };
  const result = await initiateZynlePayment(order, { config, fetchImpl: async () => ({ ok: true, json: async () => response }) });
  assert.equal(result.response_code, '120');
  assert.equal(result.transaction_id, 1234567890);
  assert.equal(result.status, undefined);
});

test('network and invalid responses are ambiguous and never imply approval', async () => {
  for (const fetchImpl of [
    async () => { throw new Error('timeout'); },
    async () => ({ ok: false, json: async () => null }),
    async () => ({ ok: true, json: async () => ({}) }),
  ]) {
    await assert.rejects(initiateZynlePayment(order, { config, fetchImpl }), error => !error.definite);
  }
});

test('credentials cannot be sent to production or a different host', async () => {
  let called = false;
  for (const apiUrl of ['https://payments.zynlepay.com/zynlepay/jsonapi/', 'https://example.test/']) {
    await assert.rejects(requestZynlePay({}, {
      config: () => ({ ...config(), apiUrl }), fetchImpl: async () => { called = true; },
    }), { code: 'PAYMENT_ENVIRONMENT_INVALID' });
  }
  assert.equal(called, false);
});

test('a mismatched reference cannot update another checkout', async () => {
  await assert.rejects(initiateZynlePayment(order, { config, fetchImpl: async () => ({
    ok: true, json: async () => ({ response_code: 'PENDING-TEST', reference_no: 'DIFFERENT-REFERENCE' }),
  }) }), { code: 'PAYMENT_MISMATCH' });
});
