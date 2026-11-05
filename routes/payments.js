import { Router } from 'express';

import { OrderError } from '../orders.js';
import { PaymentError } from '../payment-gateway.js';
import { createPaymentService } from '../payments.js';

export function createPaymentsRouter({ service = createPaymentService() } = {}) {
  const router = Router();
  const key = request => request.get('authorization')?.replace(/^Bearer /, '');
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.get('/config', (_request, response) => response.json({ data: service.config() }));
  router.post('/initiate', async (request, response) => response.status(201).json({ data: await service.initiate(request.body) }));
  router.get('/:reference', async (request, response) => response.json({ data: await service.status(request.params.reference, key(request)) }));
  router.post('/:reference/verify', async (request, response) => response.json({ data: await service.verify(request.params.reference, key(request)) }));
  router.use((error, _request, response, _next) => {
    if (error instanceof PaymentError || error instanceof OrderError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
    } else {
      console.error('[payments]', error.code || 'PAYMENT_STORAGE_ERROR');
      response.status(503).json({ error: { code: 'PAYMENT_STORAGE_ERROR', message: 'Payment storage is unavailable. Check this payment before trying again.' } });
    }
  });
  return router;
}

export default createPaymentsRouter();
