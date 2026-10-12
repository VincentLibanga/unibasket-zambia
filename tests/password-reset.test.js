import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { createPasswordResetService } from '../password-reset.js';

function fixture() {
  let time = 100000;
  const messages = [];
  const service = createPasswordResetService({
    now: () => time,
    sendCode: async message => messages.push(message),
  });
  return { service, messages, advance: milliseconds => { time += milliseconds; } };
}

test('reset requires the emailed code and matching address, and is single use', async () => {
  const { service, messages } = fixture();
  const challenge = await service.request('buyer@example.test', 'client');
  assert.match(challenge.challengeId, /^[a-f0-9]{64}$/);
  assert.equal(Object.hasOwn(challenge, 'code'), false);
  assert.match(messages[0].code, /^\d{6}$/);
  assert.throws(() => service.verify({ ...challenge, email: 'other@example.test', code: messages[0].code }), { code: 'RESET_EXPIRED' });
  const request = { ...challenge, email: 'buyer@example.test', code: messages[0].code };
  assert.deepEqual(service.verify(request), { status: 'verified' });
  assert.throws(() => service.verify(request), { code: 'RESET_EXPIRED' });
});

test('reset expires after ten minutes', async () => {
  const { service, messages, advance } = fixture();
  const challenge = await service.request('buyer@example.test', 'client');
  advance(10 * 60 * 1000);
  assert.throws(() => service.verify({ ...challenge, email: 'buyer@example.test', code: messages[0].code }), { code: 'RESET_EXPIRED' });
});

test('five incorrect attempts invalidate the code', async () => {
  const { service, messages } = fixture();
  const challenge = await service.request('buyer@example.test', 'client');
  const wrong = messages[0].code === '000000' ? '000001' : '000000';
  for (let attempt = 1; attempt <= 5; attempt++) {
    assert.throws(() => service.verify({ ...challenge, email: 'buyer@example.test', code: wrong }),
      { code: attempt === 5 ? 'RESET_ATTEMPTS_EXCEEDED' : 'RESET_INVALID_CODE' });
  }
  assert.throws(() => service.verify({ ...challenge, email: 'buyer@example.test', code: messages[0].code }), { code: 'RESET_EXPIRED' });
});

test('resends are throttled and invalidate the earlier challenge', async () => {
  const { service, messages, advance } = fixture();
  const first = await service.request('buyer@example.test', 'client');
  await assert.rejects(service.request('buyer@example.test', 'client'), { code: 'RESET_RATE_LIMIT' });
  advance(60000);
  const second = await service.request('buyer@example.test', 'client');
  assert.throws(() => service.verify({ ...first, email: 'buyer@example.test', code: messages[0].code }), { code: 'RESET_EXPIRED' });
  assert.equal(service.verify({ ...second, email: 'buyer@example.test', code: messages[1].code }).status, 'verified');
  advance(60000);
  await service.request('buyer@example.test', 'client');
  advance(60000);
  await assert.rejects(service.request('buyer@example.test', 'client'), { code: 'RESET_RATE_LIMIT' });
  advance(60 * 60 * 1000);
  await service.request('buyer@example.test', 'client');
});

test('per-client limits prevent flooding different email addresses', async () => {
  const { service } = fixture();
  for (let index = 0; index < 10; index++) await service.request(`buyer${index}@example.test`, 'client');
  await assert.rejects(service.request('other@example.test', 'client'), { code: 'RESET_RATE_LIMIT' });
});

test('failed email delivery does not produce a reset challenge', async () => {
  const service = createPasswordResetService({ sendCode: async () => { throw new Error('SMTP unavailable'); } });
  await assert.rejects(service.request('buyer@example.test', 'client'), /SMTP unavailable/);
  assert.throws(() => service.verify({ challengeId: 'unknown', email: 'buyer@example.test', code: '123456' }), { code: 'RESET_EXPIRED' });
});

const script = await readFile(new URL('../public/script.js', import.meta.url), 'utf8');
const start = script.indexOf('async function submitPasswordReset()');
const source = script.slice(start, script.indexOf('\n}\n', start) + 2);

async function resetScenario({ rejects = false, confirm = 'new password' } = {}) {
  const account = { name: 'Buyer', email: 'buyer@example.test', role: 'seller', salt: 'old salt', verifier: 'old verifier' };
  const other = { email: 'other@example.test', salt: 'other salt', verifier: 'other verifier' };
  const elements = Object.fromEntries(['resetPasswordForm', 'resetPassword', 'resetConfirm', 'resetCode', 'accountEmail', 'accountStatus', 'accountPassword'].map(id => [id, { value: '', focus() {}, reportValidity: () => true }]));
  elements.resetPassword.value = 'new password';
  elements.resetConfirm.value = confirm;
  elements.resetCode.value = '123456';
  const calls = [];
  let saved;
  let error;
  const context = {
    accountBusy: false,
    resetChallenge: { challengeId: 'challenge', email: account.email },
    clearAccountFeedback() {},
    document: { getElementById: id => elements[id] },
    setAccountBusy() {},
    accountError: message => { error = message; },
    crypto: { getRandomValues: array => array.fill(42) },
    bytesToHex: bytes => Buffer.from(bytes).toString('hex'),
    passwordVerifier: async () => 'new verifier',
    resetApi: async (path, body) => {
      calls.push({ path, body });
      if (rejects) throw new Error('That code is incorrect.');
      return { status: 'verified' };
    },
    readAccounts: () => [account, other],
    writeAccounts: users => { saved = users; },
    setAccountMode: mode => calls.push(mode),
  };
  await vm.runInNewContext(`${source}\nsubmitPasswordReset();`, context);
  return { account, other, saved, calls, error, elements };
}

test('verified reset replaces credentials and preserves account identity and other accounts', async () => {
  const { account, other, saved, calls, elements } = await resetScenario();
  assert.equal(saved[0], account);
  assert.equal(account.name, 'Buyer');
  assert.equal(account.role, 'seller');
  assert.equal(account.salt, '2a'.repeat(16));
  assert.equal(account.verifier, 'new verifier');
  assert.equal(saved[1], other);
  assert.equal(other.verifier, 'other verifier');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].body)), { email: account.email, challengeId: 'challenge', code: '123456' });
  assert.equal(calls[1], 'login');
  assert.match(elements.accountStatus.textContent, /password was reset/);
});

test('incorrect code never changes saved credentials', async () => {
  const { account, saved, error } = await resetScenario({ rejects: true });
  assert.equal(saved, undefined);
  assert.equal(account.verifier, 'old verifier');
  assert.match(error, /incorrect/);
});

test('mismatched passwords do not consume the reset code', async () => {
  const { saved, calls, error } = await resetScenario({ confirm: 'different password' });
  assert.equal(saved, undefined);
  assert.equal(calls.length, 0);
  assert.match(error, /do not match/);
});

test('file previews explain how to open the running app without attempting an unsupported request', async () => {
  const start = script.indexOf('async function resetApi(');
  const source = script.slice(start, script.indexOf('\n}\n', start) + 2);
  const context = {
    window: { location: { protocol: 'file:' } },
    fetch: () => { throw new Error('Should not fetch from a file preview'); },
  };
  await assert.rejects(vm.runInNewContext(`${source}\nresetApi('', { email: 'buyer@example.test' });`, context), /Open http:\/\/127\.0\.0\.1:4176/);
});
