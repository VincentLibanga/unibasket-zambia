import { Router } from 'express';

import { sendPaymentReceipt } from '../mail.js';
import { authenticateZynleCallback, PaymentError } from '../zynlepay.js';
import { createPaymentService } from '../payments.js';

export function createPaymentsRouter({
  service = createPaymentService({ sendReceipt: sendPaymentReceipt }),
  callbackSecret = () => process.env.ZYNLEPAY_CALLBACK_SECRET,
} = {}) {
  const router = Router();
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  router.post('/callback', (request, response, next) => {
    try {
      authenticateZynleCallback(request.query.token, callbackSecret());
      response.json(service.receiveCallback(request.body));
    } catch (error) {
      next(error);
    }
  });
  router.post('/checkout', (request, response, next) => {
    try {
      response.status(201).json({ data: service.create(request.body) });
    } catch (error) {
      next(error);
    }
  });
  router.post('/verify', async (request, response, next) => {
    try {
      const { reference, token } = request.body || {};
      response.json({ data: await service.verify(reference, token) });
    } catch (error) {
      next(error);
    }
  });
  router.post('/initiate', async (request, response, next) => {
    try {
      const { reference, token } = request.body || {};
      response.json({ data: await service.initiate(reference, token) });
    } catch (error) {
      next(error);
    }
  });
  router.use((error, _request, response, next) => {
    if (!(error instanceof PaymentError)) return next(error);
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
  });
  return router;
}

export default createPaymentsRouter();
