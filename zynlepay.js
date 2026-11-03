export const ZYNLEPAY_SANDBOX_URL = 'https://sandbox.zynlepay.com/zynlepay/jsonapi';

export class PaymentError extends Error {
  constructor(code, message, status = 400, { definite = false } = {}) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    this.status = status;
    this.definite = definite;
  }
}

export function zynlepayConfig() {
  const merchantId = (process.env.ZYNLEPAY_SANDBOX_MERCHANT_CODE || '').trim();
  const apiId = (process.env.ZYNLEPAY_SANDBOX_API_ID || '').trim();
  const apiKey = (process.env.ZYNLEPAY_SANDBOX_API_KEY || '').trim();
  const apiUrl = (process.env.ZYNLEPAY_SANDBOX_API_URL || ZYNLEPAY_SANDBOX_URL).replace(/\/$/, '');
  if (apiUrl !== ZYNLEPAY_SANDBOX_URL) {
    throw new PaymentError('PAYMENT_ENVIRONMENT_INVALID', 'Only the ZynlePay sandbox is enabled for this shop.', 503, { definite: true });
  }
  if (!merchantId || !apiId || !apiKey || [merchantId, apiId, apiKey].some(value => /^(xxxx|your[-_])/i.test(value))) {
    throw new PaymentError('PAYMENT_NOT_CONFIGURED', 'ZynlePay test payments are not available yet. Please try again later.', 503, { definite: true });
  }
  return { merchantId, apiId, apiKey, apiUrl };
}

export function normalizeMobileNumber(value) {
  let phone = String(value || '').trim().replace(/[ ()-]/g, '').replace(/^\+/, '');
  if (/^0[79]\d{8}$/.test(phone)) phone = '260' + phone.slice(1);
  if (!/^260[79]\d{8}$/.test(phone)) {
    throw new PaymentError('INVALID_PAYMENT_DETAILS', 'Enter a Zambian mobile money number, for example 097 000 0000.', 400, { definite: true });
  }
  return phone;
}

function assertSandboxUrl(apiUrl) {
  // Check again even with an injected configuration; credentials never go to another host.
  if (apiUrl?.replace(/\/$/, '') !== ZYNLEPAY_SANDBOX_URL) {
    throw new PaymentError('PAYMENT_ENVIRONMENT_INVALID', 'Only the ZynlePay sandbox is enabled for this shop.', 503, { definite: true });
  }
}

async function postZynleJson(apiUrl, body, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(apiUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      redirect: 'error', signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new PaymentError('PAYMENT_UNREACHABLE', 'ZynlePay could not be reached. Keep your payment reference and check its status before paying again.', 503);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== 'object' || Array.isArray(payload) ||
      !['string', 'number'].includes(typeof payload.response_code)) {
    throw new PaymentError('PAYMENT_RESPONSE_INVALID', 'ZynlePay could not confirm the result. Keep your payment reference and check its status before paying again.', 503);
  }
  return payload;
}

export async function requestZynlePay(data, { config = zynlepayConfig, fetchImpl = fetch } = {}) {
  const { merchantId, apiId, apiKey, apiUrl } = config();
  assertSandboxUrl(apiUrl);
  const payload = await postZynleJson(apiUrl, {
    auth: { merchant_id: merchantId, api_id: apiId, api_key: apiKey, channel: 'momo' }, data,
  }, fetchImpl);
  // Do not forward arbitrary provider messages: a response may contain credentials.
  // Authentication errors use a placeholder reference, so inspect them first.
  if (String(payload.response_code) === '9902') {
    throw new PaymentError('PAYMENT_AUTH_FAILED', 'ZynlePay rejected the shop’s sandbox credentials. Please contact the shop before trying again.', 503, { definite: true });
  }
  if (String(payload.response_code) === '2000') {
    throw new PaymentError('SIMULATOR_NOT_CONFIGURED', 'This number has no active ZynlePay sandbox simulator. Enable a simulator for this number in your sandbox account, then try again.', 422, { definite: true });
  }
  if (payload.reference_no !== data.reference_no) {
    throw new PaymentError('PAYMENT_MISMATCH', 'The payment reference does not match this checkout. Please contact the shop with your order reference.', 409);
  }
  return payload;
}

export async function initiateZynlePayment(order, options) {
  return requestZynlePay({
    method: 'runBillPayment', sender_id: normalizeMobileNumber(order.phone),
    reference_no: order.reference, amount: order.total.toFixed(2),
  }, options);
}

export async function getZynlePaymentStatus(order, { config = zynlepayConfig, fetchImpl = fetch } = {}) {
  const { apiId, apiKey, apiUrl } = config();
  assertSandboxUrl(apiUrl);
  // Payment Status has its own endpoint and a flat request body, unlike initiation.
  const payload = await postZynleJson(`${ZYNLEPAY_SANDBOX_URL}/paymentstatus`, {
    api_id: apiId, api_key: apiKey, reference_no: order.reference,
  }, fetchImpl);
  if (String(payload.response_code) === '9902') {
    // A status-query authentication error cannot establish that the charge failed.
    throw new PaymentError('PAYMENT_AUTH_FAILED', 'ZynlePay rejected the shop’s sandbox credentials. Payment completion could not be checked. Please contact the shop.', 503);
  }
  if (payload.reference_no !== order.reference) {
    throw new PaymentError('PAYMENT_MISMATCH', 'The payment reference does not match this checkout. Please contact the shop with your order reference.', 409);
  }
  // The observed 995 response says completion could not be confirmed. Its terminal
  // meaning and the success response have not been documented yet. Never infer paid
  // status, amount, or currency from HTTP 200, a message, or the local order snapshot.
  return {
    reference: payload.reference_no, status: 'pending', confirmationAvailable: false,
    ...(/^\d{1,6}$/.test(String(payload.response_code)) ? { gatewayCode: String(payload.response_code) } : {}),
  };
}
