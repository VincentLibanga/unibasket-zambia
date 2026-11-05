import { randomBytes } from 'node:crypto';

import { sendOrderReceipt } from './mail.js';

export const DELIVERY_METHODS = {
  campus: { label: 'Campus drop-off', charge: 25 },
  pickup: { label: 'Collection point', charge: 0 },
  courier: { label: 'City courier', charge: 50 },
};

export class OrderError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'OrderError';
    this.code = code;
    this.status = status;
  }
}

function invalid(message) {
  throw new OrderError('INVALID_ORDER_DETAILS', message);
}

function orderDetails(input) {
  const { email, name, deliveryMethod, deliveryNote, items } = input || {};
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    invalid('Sign in with a valid email address before placing an order.');
  }
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    invalid('Enter your full name before placing the order.');
  }
  if (!Object.hasOwn(DELIVERY_METHODS, deliveryMethod)) invalid('Choose a delivery method.');
  if (typeof deliveryNote !== 'string' || !deliveryNote.trim() || deliveryNote.trim().length > 200) {
    invalid('Enter a delivery or collection note of up to 200 characters.');
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) invalid('Your basket is empty or too large.');
  const lines = items.map(item => {
    const quantity = item?.quantity;
    const price = item?.price;
    // Browser-saved seller listings remain supported by this order preview.
    if (typeof item?.name !== 'string' || !item.name.trim() || item.name.length > 160 ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > 99 ||
        typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 100000 ||
        Math.abs(price * 100 - Math.round(price * 100)) > 0.000001) {
      invalid('One of the basket items is not valid. Refresh the page and try again.');
    }
    return { name: item.name.trim(), quantity, price, lineTotal: Math.round(price * 100) * quantity / 100 };
  });
  const subtotal = lines.reduce((sum, line) => sum + Math.round(line.lineTotal * 100), 0) / 100;
  const delivery = DELIVERY_METHODS[deliveryMethod];
  return {
    name: name.trim(), email: email.toLowerCase(), lines,
    deliveryMethod: delivery.label, deliveryCharge: delivery.charge, deliveryNote: deliveryNote.trim(),
    subtotal, total: (Math.round(subtotal * 100) + delivery.charge * 100) / 100,
  };
}

export function createOrderService({ sendReceipt = sendOrderReceipt, now = Date.now } = {}) {
  const orders = new Map();
  const lifetime = 24 * 60 * 60 * 1000;

  async function place(input) {
    const key = input?.idempotencyKey;
    if (typeof key !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key)) {
      invalid('Refresh checkout and try again.');
    }
    const details = orderDetails(input);
    const fingerprint = JSON.stringify(details);
    const timestamp = now();
    for (const [id, order] of orders) {
      if (!order.sending && order.timestamp + lifetime < timestamp) orders.delete(id);
    }
    let order = orders.get(key);
    if (order && order.fingerprint !== fingerprint) {
      throw new OrderError('ORDER_CONFLICT', 'This order reference is already used for different order details.', 409);
    }
    if (!order) {
      if (orders.size >= 1000) throw new OrderError('ORDER_BUSY', 'Checkout is busy. Please try again later.', 503);
      order = {
        timestamp, fingerprint, sending: null, result: null,
        receipt: {
          ...details, orderId: `UBZ-${randomBytes(16).toString('hex').toUpperCase()}`,
          createdAt: new Date(timestamp).toISOString(), paymentStatus: 'unpaid',
        },
      };
      orders.set(key, order);
    }
    if (order.result) return order.result;
    if (!order.sending) {
      order.sending = (async () => {
        await sendReceipt(order.receipt);
        const { orderId, createdAt, name, email, subtotal, deliveryCharge, total } = order.receipt;
        order.result = {
          status: 'confirmed', paymentStatus: 'unpaid', emailSent: true,
          orderId, createdAt, name, email, subtotal, deliveryCharge, total,
        };
        return order.result;
      })().finally(() => { order.sending = null; });
    }
    return order.sending;
  }

  return { place };
}
