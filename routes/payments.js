import { randomBytes } from 'node:crypto';
import { Router } from 'express';

import { MailError, sendPaymentReceipt } from '../mail.js';

const router = Router();

export const PAYMENT_METHODS = {
  mtn_momo: 'MTN MoMo',
  airtel_money: 'Airtel Money',
  zamtel_kwacha: 'Zamtel Kwacha',
  card: 'Visa / Mastercard (test)',
};

export const DELIVERY_METHODS = {
  campus: { label: 'Campus drop-off', charge: 15 },
  pickup: { label: 'Collection point', charge: 0 },
  courier: { label: 'City courier', charge: 30 },
};

const OUTCOMES = ['SUCCESS', 'DECLINED', 'CANCELLED'];

function reference(prefix) {
  return `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function invalid(response, message) {
  response.status(400).json({ error: { code: 'INVALID_PAYMENT_DETAILS', message } });
}

router.post('/', async (request, response, next) => {
  const { email, name, phone, paymentMethod, deliveryMethod, deliveryNote, outcome, items } = request.body || {};

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    invalid(response, 'Sign in with a valid email address before paying.');
    return;
  }
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    invalid(response, 'Enter your full name before placing the order.');
    return;
  }
  if (typeof phone !== 'string' || !/^\+?[0-9 ()-]{9,20}$/.test(phone.trim())) {
    invalid(response, 'Enter a valid phone number, for example 097 000 0000.');
    return;
  }
  if (!Object.hasOwn(PAYMENT_METHODS, paymentMethod)) {
    invalid(response, 'Choose a payment method.');
    return;
  }
  if (!Object.hasOwn(DELIVERY_METHODS, deliveryMethod)) {
    invalid(response, 'Choose a delivery method.');
    return;
  }
  if (!OUTCOMES.includes(outcome)) {
    invalid(response, 'Choose a payment test outcome.');
    return;
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    invalid(response, 'Your basket is empty.');
    return;
  }
  const lines = [];
  for (const item of items) {
    const quantity = Number(item?.quantity);
    const price = Number(item?.price);
    if (typeof item?.name !== 'string' || !item.name.trim() || item.name.length > 120 ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > 99 ||
        !Number.isFinite(price) || price < 0 || price > 100000) {
      invalid(response, 'One of the basket items is not valid. Refresh the page and try again.');
      return;
    }
    lines.push({ name: item.name.trim(), quantity, price, lineTotal: price * quantity });
  }

  const paymentRef = reference('DEMO');
  if (outcome !== 'SUCCESS') {
    const declined = outcome === 'DECLINED';
    response.status(402).json({
      error: {
        code: declined ? 'PAYMENT_DECLINED' : 'PAYMENT_CANCELLED',
        message: declined
          ? 'The demonstration payment was declined. Your basket is unchanged.'
          : 'The demonstration payment was cancelled. Your basket is unchanged.',
        paymentRef,
      },
    });
    return;
  }

  const delivery = DELIVERY_METHODS[deliveryMethod];
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const receipt = {
    orderId: reference('UBZ'),
    paymentRef,
    paidAt: new Date().toISOString(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    paymentMethod: PAYMENT_METHODS[paymentMethod],
    deliveryMethod: delivery.label,
    deliveryNote: typeof deliveryNote === 'string' ? deliveryNote.trim().slice(0, 200) : '',
    lines,
    subtotal,
    deliveryCharge: delivery.charge,
    total: subtotal + delivery.charge,
  };

  // The demo payment has been approved at this point; a failed receipt email must not undo the order.
  let emailSent = false;
  try {
    await sendPaymentReceipt(receipt);
    emailSent = true;
  } catch (error) {
    if (!(error instanceof MailError)) {
      next(error);
      return;
    }
    console.error(`[mail] Receipt for ${receipt.orderId} not sent. ${error.code}: ${error.message}`);
  }

  response.status(201).json({
    data: {
      orderId: receipt.orderId,
      paymentRef: receipt.paymentRef,
      paidAt: receipt.paidAt,
      paymentMethod: receipt.paymentMethod,
      subtotal: receipt.subtotal,
      deliveryCharge: receipt.deliveryCharge,
      total: receipt.total,
      emailSent,
    },
  });
});

export default router;
