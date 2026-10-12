import { Router } from 'express';
import { MailError, sendPasswordResetCode } from '../mail.js';
import { createPasswordResetService, ResetError } from '../password-reset.js';

const router = Router();
const resets = createPasswordResetService({ sendCode: sendPasswordResetCode });

function emailFrom(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ResetError('INVALID_RESET_EMAIL', 'Enter a valid email address.');
  }
  return email;
}

function handleError(error, response, next) {
  if (error instanceof ResetError || error instanceof MailError) {
    response.status(error.status || 503).json({ error: { code: error.code, message: error.message } });
    return;
  }
  next(error);
}

router.post('/', async (request, response, next) => {
  response.set('Cache-Control', 'no-store');
  try {
    const data = await resets.request(emailFrom(request.body), request.ip);
    response.status(202).json({ data });
  } catch (error) {
    handleError(error, response, next);
  }
});

router.post('/verify', (request, response, next) => {
  response.set('Cache-Control', 'no-store');
  try {
    const email = emailFrom(request.body);
    const { challengeId, code } = request.body;
    response.json(resets.verify({ challengeId, email, code }));
  } catch (error) {
    handleError(error, response, next);
  }
});

export default router;
