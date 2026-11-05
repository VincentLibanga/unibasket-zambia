import nodemailer from 'nodemailer';

const appUrl = process.env.APP_URL || `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 4176}`;

export class MailError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'MailError';
    this.code = code;
  }
}

export function readMailConfig(env = process.env) {
  // Select one complete credential set. Never send legacy Gmail credentials to
  // a custom SMTP host when only part of a new provider's config has been entered.
  const custom = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD']
    .some(name => Boolean(env[name]));
  const legacy = !custom && (!env.MAIL_HOST || env.MAIL_HOST.trim() === 'smtp.gmail.com');
  const host = custom ? (env.SMTP_HOST || '').trim() : legacy ? 'smtp.gmail.com' : (env.MAIL_HOST || '').trim();
  const user = custom ? (env.SMTP_USER || '').trim() : legacy ? (env.GMAIL_USER || '').trim() : '';
  // Only the legacy Google App Password is normalized. Other SMTP passwords may
  // legitimately contain spaces and have lengths other than 16 characters.
  const pass = custom ? (env.SMTP_PASSWORD || '') : legacy ? (env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '') : '';
  const secureValue = (env.SMTP_SECURE || '').trim().toLowerCase();
  const port = Number(env.SMTP_PORT || (legacy || secureValue === 'true' ? 465 : 587));
  const secure = secureValue ? secureValue === 'true' : port === 465;
  const from = (env.MAIL_FROM || '').trim() || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user) ? `UniBasket Zambia <${user}>` : '');
  const missing = [];
  const invalid = [];
  if (!host) missing.push('SMTP_HOST');
  if (!user || user === 'your-account@gmail.com') missing.push(custom || !legacy ? 'SMTP_USER' : 'GMAIL_USER');
  if (!pass || pass === 'your-16-character-app-password') missing.push(custom || !legacy ? 'SMTP_PASSWORD' : 'GMAIL_APP_PASSWORD');
  if (!from) missing.push('MAIL_FROM');
  if (host && (/\s/.test(host) || host.includes('://'))) invalid.push('SMTP_HOST must be a hostname without a URL scheme');
  if (!Number.isInteger(port) || port < 1 || port > 65535) invalid.push('SMTP_PORT must be a port number from 1 to 65535');
  if (secureValue && !['true', 'false'].includes(secureValue)) invalid.push('SMTP_SECURE must be true or false');
  if (legacy && pass && pass !== 'your-16-character-app-password' && pass.length !== 16) {
    invalid.push('GMAIL_APP_PASSWORD must be a 16-character Google App Password');
  }
  return { host, port, secure, user, pass, from, missing, invalid };
}

function toMailError(error) {
  if (error instanceof MailError) return error;
  if (error.code === 'EAUTH' || error.responseCode === 535 || error.responseCode === 534) {
    return new MailError('MAIL_AUTH_FAILED',
      'The SMTP server rejected the login. Check the SMTP username and password or provider app password in .env.',
      { cause: error });
  }
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(error.code)) {
    return new MailError('MAIL_UNREACHABLE',
      'The SMTP server could not be reached. Check SMTP_HOST, SMTP_PORT, TLS settings and the network connection.',
      { cause: error });
  }
  if (error.responseCode >= 500 && error.responseCode < 600) {
    return new MailError('MAIL_REJECTED', 'The SMTP server refused to deliver the message. Check the sender and recipient addresses.', { cause: error });
  }
  return new MailError('MAIL_FAILED', 'The email could not be sent.', { cause: error });
}

export function createMailService({ env = () => process.env, createTransport = options => nodemailer.createTransport(options) } = {}) {
  let transporter;

  function config() {
    const value = readMailConfig(env());
    const issues = [
      ...(value.missing.length ? [`Set ${value.missing.join(', ')} in .env`] : []),
      ...value.invalid,
    ];
    if (issues.length) throw new MailError('MAIL_NOT_CONFIGURED', issues.join('. ') + '.');
    return value;
  }

  function transport(value) {
    if (!transporter) transporter = createTransport({
      host: value.host, port: value.port, secure: value.secure,
      requireTLS: !value.secure,
      auth: { user: value.user, pass: value.pass },
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
      connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 20000,
    });
    return transporter;
  }

  async function perform(operation) {
    try {
      const value = config();
      return await operation(transport(value), value);
    } catch (error) {
      transporter = undefined;
      throw toMailError(error);
    }
  }

  return {
    isConfigured: () => {
      const value = readMailConfig(env());
      return value.missing.length === 0 && value.invalid.length === 0;
    },
    verify: () => perform(client => client.verify()),
    send: message => perform((client, value) => client.sendMail({ ...message, from: value.from })),
  };
}

const mailService = createMailService();
export const isMailConfigured = () => mailService.isConfigured();
export const verifyMail = () => mailService.verify();
export const sendMail = message => mailService.send(message);

export async function sendAccountConfirmation({ email, name }) {
  return sendMail({
    to: email,
    subject: 'Welcome to UniBasket Zambia',
    text: `Hi ${name},\n\nYour UniBasket Zambia account has been created successfully.\n\nYou can now sign in and continue shopping: ${appUrl}\n\nThank you,\nUniBasket Zambia`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>Your UniBasket Zambia account has been created successfully.</p><p><a href="${escapeHtml(appUrl)}">Open UniBasket Zambia</a></p><p>Thank you,<br>UniBasket Zambia</p>`,
  });
}

export async function sendPasswordResetCode({ email, code }) {
  return sendMail({
    to: email,
    subject: 'Your UniBasket password reset code',
    text: `Your UniBasket password reset code is ${code}.\n\nIt expires in 10 minutes and can be used once. Return to the browser where you created your account to enter it.\n\nIf you did not request this code, you can ignore this email. Never share this code.`,
    html: `<p>Your UniBasket password reset code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${escapeHtml(code)}</p><p>It expires in 10 minutes and can be used once. Return to the browser where you created your account to enter it.</p><p>If you did not request this code, you can ignore this email. Never share this code.</p>`,
  });
}

export function buildOrderReceipt(receipt) {
  const money = value => `ZMW ${Number(value).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const createdAt = new Date(receipt.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Lusaka' });
  const textLines = receipt.lines
    .map(line => `  ${line.quantity} x ${line.name} — ${money(line.lineTotal)}`)
    .join('\n');
  const htmlRows = receipt.lines
    .map(line => `<tr><td>${line.quantity} × ${escapeHtml(line.name)}</td><td align="right">${money(line.lineTotal)}</td></tr>`)
    .join('');
  const deliveryNote = receipt.deliveryNote ? ` (${receipt.deliveryNote})` : '';
  const paid = receipt.paymentStatus === 'paid';
  const test = paid && receipt.paymentMode === 'test';
  const paymentStatus = paid
    ? test ? 'Paid (test). No real money was collected.' : `Paid. Payment verified through ${receipt.paymentProvider || 'the payment provider'}.`
    : 'Unpaid. No payment was collected.';
  const paymentReference = paid ? `Payment reference: ${receipt.paymentRef}\n` : '';
  const receiptNote = paid
    ? test ? 'This receipt records a test payment and is not proof of a real payment.' : 'Keep this paid order receipt for your records.'
    : 'Keep this order receipt for your records. It confirms your order and is not proof of payment.';

  return {
    to: receipt.email,
    subject: `UniBasket Zambia order confirmation ${receipt.orderId}`,
    text: `Hi ${receipt.name},\n\nThank you for your order. Your order has been received.\n\n` +
      `Order reference: ${receipt.orderId}\nDate: ${createdAt}\n` +
      `Payment status: ${paymentStatus}\n${paymentReference}\n` +
      `Items:\n${textLines}\n\nSubtotal: ${money(receipt.subtotal)}\n` +
      `Delivery: ${receipt.deliveryMethod}${deliveryNote} — ${money(receipt.deliveryCharge)}\n` +
      `Order total: ${money(receipt.total)}\n\n` +
      `${receiptNote}\n\nUniBasket Zambia\n${appUrl}`,
    html: `<p>Hi ${escapeHtml(receipt.name)},</p>` +
      `<p>Thank you for your order. Your order has been received.</p>` +
      `<p><strong>Order reference:</strong> ${escapeHtml(receipt.orderId)}<br>` +
      `<strong>Date:</strong> ${escapeHtml(createdAt)}</p>` +
      `<p><strong>Payment status:</strong> ${escapeHtml(paymentStatus)}</p>` +
      (paid ? `<p><strong>Payment reference:</strong> ${escapeHtml(receipt.paymentRef)}</p>` : '') +
      `<table cellpadding="6" style="border-collapse:collapse;min-width:320px">${htmlRows}` +
      `<tr><td>Subtotal</td><td align="right">${money(receipt.subtotal)}</td></tr>` +
      `<tr><td>Delivery: ${escapeHtml(receipt.deliveryMethod + deliveryNote)}</td><td align="right">${money(receipt.deliveryCharge)}</td></tr>` +
      `<tr><td><strong>Order total</strong></td><td align="right"><strong>${money(receipt.total)}</strong></td></tr></table>` +
      `<p style="color:#666">${escapeHtml(receiptNote)}</p>` +
      `<p>UniBasket Zambia<br><a href="${escapeHtml(appUrl)}">${escapeHtml(appUrl)}</a></p>`,
  };
}

export async function sendOrderReceipt(receipt) {
  return sendMail(buildOrderReceipt(receipt));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character]));
}
