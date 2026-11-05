import express from 'express';
import { fileURLToPath } from 'node:url';

import { verifyDatabase } from './db.js';
import categoriesRouter from './routes/categories.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import paymentsRouter from './routes/payments.js';
import passwordResetsRouter from './routes/password-resets.js';
import { isMailConfigured, MailError, sendAccountConfirmation, verifyMail } from './mail.js';

const app = express();
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4176);

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(express.static(fileURLToPath(new URL('./public', import.meta.url)), { extensions: ['html'] }));

app.get('/api/health', async (_request, response, next) => {
  try {
    await verifyDatabase();
    response.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});

app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/password-resets', passwordResetsRouter);

app.post('/api/account-confirmations', async (request, response, next) => {
  const { email, name } = request.body || {};
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    response.status(400).json({
      error: { code: 'INVALID_CONFIRMATION_DETAILS', message: 'A valid name and email address are required.' },
    });
    return;
  }
  try {
    await sendAccountConfirmation({ email: email.trim().toLowerCase(), name: name.trim() });
    response.status(202).json({ status: 'sent' });
  } catch (error) {
    if (error instanceof MailError) {
      console.error(`[mail] ${error.code}: ${error.message}`, error.cause?.message || '');
      const status = error.code === 'MAIL_REJECTED' ? 422 : 503;
      response.status(status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    next(error);
  }
});

app.use('/api', (_request, response) => {
  response.status(404).json({
    error: { code: 'API_NOT_FOUND', message: 'The requested API route does not exist.' },
  });
});

app.use((error, _request, response, _next) => {
  if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
    response.status(error.status).json({
      error: { code: 'INVALID_REQUEST_BODY', message: error.status === 413 ? 'The request body is too large.' : 'The request body must contain valid JSON.' },
    });
    return;
  }
  console.error(error);
  response.status(500).json({
    error: { code: 'SERVER_ERROR', message: 'The server could not complete the request.' },
  });
});

app.listen(port, host, () => {
  console.log(`UniBasket Task 3 is running at http://${host}:${port}`);
});

try {
  await verifyDatabase();
  console.log('[db] Supabase Postgres connection and catalogue tables verified.');
} catch (error) {
  console.error('[db] UniBasket could not connect to Supabase. Set DATABASE_URL in .env and run npm run db:setup.');
  console.error(`[db] ${error.message}`);
  console.error('[db] The site will use its local preview catalogue until Supabase is available.');
}

if (!isMailConfigured()) {
  console.warn('[mail] SMTP is not configured: check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and MAIL_FROM in .env.');
} else {
  verifyMail()
    .then(() => console.log('[mail] SMTP connection and login verified.'))
    .catch(error => console.warn(`[mail] ${error.message}`));
}
