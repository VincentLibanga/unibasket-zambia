import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { createMailService, readMailConfig } from '../mail.js';

const settings = {
  SMTP_HOST: 'smtp.provider.test', SMTP_PORT: '587', SMTP_SECURE: 'false',
  SMTP_USER: 'provider-login', SMTP_PASSWORD: '  long password with spaces  ',
  MAIL_FROM: 'UniBasket Zambia <orders@example.test>',
};
function fixture(env = settings, operations = {}) {
  const options = [];
  const messages = [];
  let verifications = 0;
  const service = createMailService({ env: () => env, createTransport: value => {
    options.push(value);
    return {
      verify: async () => { verifications++; },
      sendMail: async message => { messages.push(message); return { messageId: 'test-message' }; },
      ...operations,
    };
  } });
  return { service, options, messages, verifications: () => verifications };
}

test('custom SMTP uses its own host, preserves the password and requires STARTTLS', async () => {
  const { service, options, messages, verifications } = fixture();
  assert.equal(service.isConfigured(), true);
  await service.verify();
  assert.equal(verifications(), 1);
  assert.equal(messages.length, 0, 'login verification must not send email');
  assert.equal(options[0].host, settings.SMTP_HOST);
  assert.equal(options[0].port, 587);
  assert.equal(options[0].secure, false);
  assert.equal(options[0].requireTLS, true);
  assert.deepEqual(options[0].auth, { user: settings.SMTP_USER, pass: settings.SMTP_PASSWORD });
  assert.equal(options[0].tls.rejectUnauthorized, true);
  const result = await service.send({ to: 'buyer@example.test', from: 'wrong@example.test', subject: 'Test', text: 'Test' });
  assert.equal(result.messageId, 'test-message');
  assert.equal(messages[0].from, settings.MAIL_FROM);
  assert.equal(options.length, 1, 'a verified transport can be reused');
});

test('port 465 enables immediate TLS without imposing Gmail password rules', async () => {
  const { service, options } = fixture({ ...settings, SMTP_PORT: '465', SMTP_SECURE: '', SMTP_PASSWORD: 'short-key' });
  await service.verify();
  assert.equal(options[0].secure, true);
  assert.equal(options[0].requireTLS, false);
  assert.equal(options[0].auth.pass, 'short-key');
});

test('legacy Gmail configuration remains compatible and normalizes grouped app passwords', async () => {
  const { service, options } = fixture({
    GMAIL_USER: 'legacy@example.test', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop', MAIL_HOST: 'smtp.gmail.com',
    SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '',
  });
  await service.verify();
  assert.equal(options[0].host, 'smtp.gmail.com');
  assert.equal(options[0].port, 465);
  assert.equal(options[0].auth.pass, 'abcdefghijklmnop');
  assert.equal(options[0].auth.user, 'legacy@example.test');
});

test('a partial custom SMTP configuration never reuses legacy Gmail credentials', async () => {
  const legacy = { GMAIL_USER: 'legacy@example.test', GMAIL_APP_PASSWORD: 'abcdefghijklmnop' };
  for (const env of [
    { ...legacy, SMTP_HOST: 'smtp.new-provider.test' },
    { ...legacy, SMTP_PASSWORD: 'new-provider-key' },
    { ...legacy, MAIL_HOST: 'smtp.new-provider.test' },
  ]) {
    const { service, options, messages } = fixture(env);
    assert.equal(service.isConfigured(), false);
    await assert.rejects(service.verify(), { code: 'MAIL_NOT_CONFIGURED' });
    await assert.rejects(service.send({ to: 'buyer@example.test', text: 'Test' }), { code: 'MAIL_NOT_CONFIGURED' });
    assert.equal(options.length, 0);
    assert.equal(messages.length, 0);
  }
});

test('invalid SMTP settings fail before any network connection', async () => {
  for (const change of [
    { SMTP_PORT: 'bad' }, { SMTP_PORT: '0' }, { SMTP_PORT: '65536' },
    { SMTP_SECURE: 'maybe' }, { SMTP_HOST: 'smtp://private-password@provider.test' },
  ]) {
    const { service, options } = fixture({ ...settings, ...change });
    assert.equal(service.isConfigured(), false);
    await assert.rejects(service.verify(), error => {
      assert.equal(error.code, 'MAIL_NOT_CONFIGURED');
      assert.equal(error.message.includes('private-password'), false);
      return true;
    });
    assert.equal(options.length, 0);
  }
});

test('non-email SMTP usernames require a separate sender address', () => {
  const config = readMailConfig({ ...settings, MAIL_FROM: '' });
  assert.ok(config.missing.includes('MAIL_FROM'));
  const emailLogin = readMailConfig({ ...settings, SMTP_USER: 'orders@example.test', MAIL_FROM: '' });
  assert.equal(emailLogin.from, 'UniBasket Zambia <orders@example.test>');
});

test('SMTP failures produce provider-neutral messages without exposing provider errors', async () => {
  for (const [failure, expected] of [
    [{ code: 'EAUTH', responseCode: 535 }, 'MAIL_AUTH_FAILED'],
    [{ code: 'ECONNREFUSED' }, 'MAIL_UNREACHABLE'],
    [{ responseCode: 550 }, 'MAIL_REJECTED'],
    [{ code: 'UNKNOWN' }, 'MAIL_FAILED'],
  ]) {
    const { service } = fixture(settings, { verify: async () => {
      throw Object.assign(new Error('provider response includes private-password'), failure);
    } });
    await assert.rejects(service.verify(), error => {
      assert.equal(error.code, expected);
      assert.equal(error.message.includes('private-password'), false);
      return true;
    });
  }
});

test('an authentication failure discards the cached transport for the next attempt', async () => {
  let attempt = 0;
  const { service, options } = fixture(settings, { verify: async () => {
    if (++attempt === 1) throw Object.assign(new Error('Rejected'), { code: 'EAUTH' });
  } });
  await assert.rejects(service.verify(), { code: 'MAIL_AUTH_FAILED' });
  await service.verify();
  assert.equal(options.length, 2);
});

test('the email test command requires an explicit recipient', () => {
  const result = spawnSync(process.execPath, ['tools/send-test-email.js'], {
    cwd: new URL('../', import.meta.url), encoding: 'utf8',
    env: { ...process.env, GMAIL_USER: 'legacy@example.test' },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: npm run mail:test -- recipient@example.com/);
});
