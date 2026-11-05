import { timingSafeEqual } from 'node:crypto';

export class PaymentError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function paymentConfig(env = process.env) {
  const mode = env.PAYMENT_MODE || 'test';
  const secretKey = (env.FLW_SECRET_KEY || '').trim();
  const webhookSecret = (env.FLW_WEBHOOK_SECRET || '').trim();
  let appUrl;
  try { appUrl = new URL(env.APP_URL); } catch { /* Report configuration without exposing values. */ }
  const local = appUrl && ['localhost', '127.0.0.1', '[::1]'].includes(appUrl.hostname);
  if (!['test', 'live'].includes(mode) || !secretKey.startsWith(mode === 'test' ? 'FLWSECK_TEST-' : 'FLWSECK-') ||
      (mode === 'live' && secretKey.startsWith('FLWSECK_TEST-')) || webhookSecret.length < 24 ||
      !appUrl || appUrl.username || appUrl.password ||
      (appUrl.protocol !== 'https:' && !(mode === 'test' && local && appUrl.protocol === 'http:'))) {
    throw new PaymentError('PAYMENT_NOT_CONFIGURED',
      'Online payment is unavailable. Configure PAYMENT_MODE, FLW_SECRET_KEY, FLW_WEBHOOK_SECRET and APP_URL on the server.', 503);
  }
  const redirectUrl = new URL('/', appUrl);
  redirectUrl.searchParams.set('payment_return', '1');
  return { mode, secretKey, webhookSecret, redirectUrl: redirectUrl.href };
}

export function validCheckoutUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'checkout.flutterwave.com' && !url.username && !url.password && !url.port;
  } catch { return false; }
}

export function createFlutterwaveGateway({ env = () => process.env, fetcher = fetch } = {}) {
  async function request(path, body) {
    const config = paymentConfig(env());
    let response;
    try {
      response = await fetcher(`https://api.flutterwave.com/v3${path}`, {
        method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${config.secretKey}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new PaymentError('PAYMENT_PROVIDER_UNAVAILABLE', 'The payment provider could not be reached. Check this payment before trying another payment.', 503);
    }
    const payload = await response.json().catch(() => null);
    if (body && response.status >= 400 && response.status < 500) {
      throw new PaymentError('PAYMENT_REJECTED', 'The provider rejected this checkout request. No checkout link was created.', 502);
    }
    // A reference without a transaction yet is still pending, not a failed payment.
    if (!body && (response.status === 404 || (response.ok && payload?.status === 'error' && payload.data === null))) return null;
    if (!response.ok || payload?.status !== 'success' || !payload.data) {
      throw new PaymentError('PAYMENT_PROVIDER_ERROR', 'The payment provider could not complete the request. Check the payment status before trying again.', 502);
    }
    return payload.data;
  }

  return {
    config: () => paymentConfig(env()),
    async initiate(order) {
      const config = paymentConfig(env());
      const data = await request('/payments', {
        tx_ref: order.reference, amount: (order.amount_cents / 100).toFixed(2), currency: 'ZMW',
        redirect_url: config.redirectUrl, customer: { email: order.details.email, name: order.details.name },
        payment_options: 'card,mobilemoneyzambia',
        customizations: { title: 'UniBasket Zambia', description: `Order ${order.reference}` },
      });
      if (!validCheckoutUrl(data.link)) throw new PaymentError('INVALID_PAYMENT_LINK', 'The provider returned an invalid checkout address.', 502);
      return data.link;
    },
    verify: reference => request(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`),
    verifyWebhook(header) {
      const { webhookSecret } = paymentConfig(env());
      if (typeof header !== 'string') return false;
      const expected = Buffer.from(webhookSecret);
      const supplied = Buffer.from(header);
      return expected.length === supplied.length && timingSafeEqual(expected, supplied);
    },
  };
}
