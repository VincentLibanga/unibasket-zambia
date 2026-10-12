import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const TEN_MINUTES = 10 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const digest = value => createHash('sha256').update(value).digest();

export class ResetError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Reset codes are held only in memory. Restarting the server invalidates them.
export function createPasswordResetService({ sendCode, now = Date.now }) {
  const challenges = new Map();
  const limits = new Map();

  function clean() {
    const time = now();
    for (const [id, challenge] of challenges) {
      if (challenge.expiresAt <= time) challenges.delete(id);
    }
    for (const [key, limit] of limits) {
      if (limit.expiresAt <= time) limits.delete(key);
    }
  }

  async function request(email, ip) {
    clean();
    const time = now();
    const keys = [[`email:${email}`, 3], [`ip:${ip}`, 10]];
    for (const [key, maximum] of keys) {
      const limit = limits.get(key);
      if (limit && (limit.count >= maximum || (key.startsWith('email:') && time - limit.lastAt < 60000))) {
        throw new ResetError('RESET_RATE_LIMIT', 'Please wait before requesting another code. You can request up to three codes per hour.', 429);
      }
    }
    if (challenges.size >= 1000 || limits.size >= 5000) {
      throw new ResetError('RESET_BUSY', 'Password reset is busy. Please try again later.', 503);
    }
    for (const [key] of keys) {
      const limit = limits.get(key) || { count: 0, expiresAt: time + HOUR };
      limits.set(key, { ...limit, count: limit.count + 1, lastAt: time });
    }
    const challengeId = randomBytes(32).toString('hex');
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    // Publish only after SMTP accepts the message; never store or return the plain code.
    await sendCode({ email, code });
    for (const [id, challenge] of challenges) {
      if (challenge.email === email) challenges.delete(id);
    }
    const expiresAt = now() + TEN_MINUTES;
    challenges.set(challengeId, { email, hash: digest(code), expiresAt, attempts: 0 });
    return { challengeId, expiresAt };
  }

  function verify({ challengeId, email, code }) {
    clean();
    const challenge = challenges.get(challengeId);
    if (!challenge || challenge.email !== email) {
      throw new ResetError('RESET_EXPIRED', 'This reset code has expired or is no longer valid. Request a new code.');
    }
    challenge.attempts += 1;
    const valid = typeof code === 'string' && /^\d{6}$/.test(code) && timingSafeEqual(challenge.hash, digest(code));
    if (!valid) {
      if (challenge.attempts >= 5) {
        challenges.delete(challengeId);
        throw new ResetError('RESET_ATTEMPTS_EXCEEDED', 'Too many incorrect attempts. Request a new code.');
      }
      throw new ResetError('RESET_INVALID_CODE', 'That code is incorrect. Enter the six-digit code from your email.');
    }
    challenges.delete(challengeId);
    return { status: 'verified' };
  }

  return { request, verify };
}
