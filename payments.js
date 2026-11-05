import { createHash, randomBytes } from 'node:crypto';

import { sendOrderReceipt } from './mail.js';
import { orderDetails } from './orders.js';
import { createFlutterwaveGateway, PaymentError } from './payment-gateway.js';
import { createPaymentStore } from './payment-store.js';

const digest = value => createHash('sha256').update(value).digest('hex');
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const referencePattern = /^UBP-[A-F\d]{32}$/;

function keyHash(key) {
  if (typeof key !== 'string' || !uuid.test(key)) throw new PaymentError('INVALID_PAYMENT_KEY', 'A valid payment request key is required.');
  return digest(key);
}

function normalizeInput(input) {
  const normalized = orderDetails({ ...input, items: [{ name: 'Validation', price: 1, quantity: 1 }] });
  if (!Array.isArray(input?.items) || !input.items.length || input.items.length > 100) {
    throw new PaymentError('INVALID_PAYMENT_ITEMS', 'Add between 1 and 100 catalogue items.');
  }
  const quantities = new Map();
  for (const item of input.items) {
    if (!Number.isSafeInteger(item?.id) || item.id < 1 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new PaymentError('INVALID_PAYMENT_ITEMS', 'Online payment supports products from the shared catalogue. Browser-saved seller listings can be ordered by email.');
    }
    quantities.set(item.id, (quantities.get(item.id) || 0) + item.quantity);
    if (quantities.get(item.id) > 99) throw new PaymentError('INVALID_PAYMENT_ITEMS', 'A product quantity cannot exceed 99.');
  }
  const items = [...quantities].sort((a, b) => a[0] - b[0]).map(([id, quantity]) => ({ id, quantity }));
  return { name: normalized.name, email: normalized.email, deliveryMethod: input.deliveryMethod, deliveryNote: normalized.deliveryNote, items };
}

function publicOrder(order) {
  return {
    reference: order.reference, mode: order.mode, currency: 'ZMW', total: order.amount_cents / 100,
    paymentStatus: order.payment_status, checkoutUrl: order.payment_status === 'pending' ? order.checkout_url : null,
    emailSent: Boolean(order.receipt_sent_at), name: order.details.name, email: order.details.email,
    items: order.details.lines.map(line => ({ id: line.productId, quantity: line.quantity })),
  };
}

export function createPaymentService({ store = createPaymentStore(), gateway = createFlutterwaveGateway(), sendReceipt = sendOrderReceipt } = {}) {
  async function authorize(reference, key) {
    const hash = keyHash(key);
    const order = referencePattern.test(reference || '') ? await store.findByReference(reference) : null;
    if (!order || order.request_hash !== hash) throw new PaymentError('PAYMENT_NOT_FOUND', 'This payment is not available in this browser session.', 404);
    return order;
  }

  async function emailReceipt(order) {
    if (order.payment_status !== 'paid' || order.receipt_sent_at || !await store.claimReceipt(order.reference)) return;
    try {
      await sendReceipt({ ...order.details, orderId: order.reference, createdAt: order.created_at,
        paymentStatus: 'paid', paymentMode: order.mode, paymentRef: order.transaction_id });
      await store.receiptSent(order.reference);
    } catch {
      await store.releaseReceipt(order.reference);
      // A mail outage must never change a verified payment into a failed payment.
    }
  }

  async function reconcile(order) {
    if (order.mode !== gateway.config().mode) throw new PaymentError('PAYMENT_MODE_MISMATCH', 'This payment belongs to a different payment environment.', 409);
    if (order.payment_status !== 'paid') {
      const transaction = await gateway.verify(order.reference);
      if (transaction) {
        const rawCents = Number(transaction.amount) * 100;
        const cents = Math.round(rawCents);
        if (transaction.tx_ref !== order.reference || transaction.currency !== 'ZMW' ||
            !Number.isSafeInteger(cents) || Math.abs(rawCents - cents) > 0.000001 || cents !== Number(order.amount_cents) ||
            !/^[1-9]\d*$/.test(String(transaction.id)) ||
            typeof transaction.customer?.email !== 'string' || transaction.customer.email.toLowerCase() !== order.details.email) {
          throw new PaymentError('PAYMENT_MISMATCH', 'The provider transaction does not match this order. Contact support with your order reference.', 409);
        }
        const status = transaction.status === 'successful' ? 'paid' :
          ['failed', 'cancelled'].includes(transaction.status) ? 'failed' : 'pending';
        await store.recordVerification(order.reference, status, String(transaction.id));
      }
    }
    order = await store.findByReference(order.reference);
    await emailReceipt(order);
    return publicOrder(await store.findByReference(order.reference));
  }

  return {
    config: () => {
      try { return { available: true, provider: 'Flutterwave', mode: gateway.config().mode, currency: 'ZMW' }; }
      catch { return { available: false, provider: 'Flutterwave', mode: 'test', currency: 'ZMW' }; }
    },
    async initiate(input) {
      const config = gateway.config();
      const requestHash = keyHash(input?.idempotencyKey);
      const normalized = normalizeInput(input);
      const fingerprint = digest(JSON.stringify(normalized));
      let order = await store.findByKey(requestHash);
      if (!order) {
        const products = await store.products(normalized.items.map(item => item.id));
        const items = normalized.items.map(item => {
          const product = products.find(product => Number(product.id) === item.id);
          if (!product || Number(product.stock_quantity) < item.quantity) {
            throw new PaymentError('PRODUCT_UNAVAILABLE', 'A product is unavailable or has insufficient stock. Refresh your basket.');
          }
          return { productId: item.id, name: product.name, price: Number(product.price), quantity: item.quantity };
        });
        const details = orderDetails({ ...normalized, items });
        details.lines = details.lines.map((line, index) => ({ ...line, productId: items[index].productId }));
        order = await store.insert({ reference: `UBP-${randomBytes(16).toString('hex').toUpperCase()}`,
          request_hash: requestHash, fingerprint, mode: config.mode, details, amount_cents: Math.round(details.total * 100) });
      }
      if (order.fingerprint !== fingerprint || order.mode !== config.mode) {
        throw new PaymentError('PAYMENT_CONFLICT', 'This payment request belongs to different order details.', 409);
      }
      if (await store.claimCheckout(order.reference)) {
        try { await store.saveCheckout(order.reference, await gateway.initiate(order)); }
        catch (error) {
          if (error.code === 'PAYMENT_REJECTED') await store.rejectCheckout(order.reference);
          else await store.uncertainCheckout(order.reference);
          // Keep the durable reference. An ambiguous provider response must not create another charge.
          if (!(error instanceof PaymentError)) throw error;
        }
      }
      return publicOrder(await store.findByReference(order.reference));
    },
    status: async (reference, key) => publicOrder(await authorize(reference, key)),
    verify: async (reference, key) => reconcile(await authorize(reference, key)),
    async webhook(header, payload) {
      if (!gateway.verifyWebhook(header)) throw new PaymentError('INVALID_WEBHOOK', 'Invalid webhook authentication.', 401);
      if (payload?.event !== 'charge.completed') return;
      const reference = payload.data?.tx_ref;
      if (!referencePattern.test(reference || '')) return;
      const order = await store.findByReference(reference);
      if (order) await reconcile(order);
    },
  };
}
