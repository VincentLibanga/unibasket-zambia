import { Router } from 'express';

import { MailError } from '../mail.js';
import { createOrderService, OrderError } from '../orders.js';

export function createOrdersRouter({ service = createOrderService() } = {}) {
  const router = Router();
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  router.post('/', async (request, response, next) => {
    try {
      response.status(201).json({ data: await service.place(request.body) });
    } catch (error) {
      next(error);
    }
  });
  router.use((error, _request, response, next) => {
    if (error instanceof OrderError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
    } else if (error instanceof MailError) {
      console.warn('[mail] Order receipt could not be sent:', error.code);
      response.status(error.code === 'MAIL_REJECTED' ? 422 : 503).json({ error: { code: error.code, message: error.message } });
    } else {
      next(error);
    }
  });
  return router;
}

export default createOrdersRouter();
