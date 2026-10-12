import nodemailer from 'nodemailer';

const appUrl = process.env.APP_URL || `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 4176}`;

export class MailError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'MailError';
    this.code = code;
  }
}

let transporter = null;

function readMailConfig() {
  const user = (process.env.GMAIL_USER || '').trim();
  // Google displays App Passwords in groups of four ("abcd efgh ijkl mnop"); SMTP needs them without spaces.
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  const from = (process.env.MAIL_FROM || '').trim() || (user ? `UniBasket Zambia <${user}>` : '');
  const missing = [];
  if (!user || user === 'your-account@gmail.com') missing.push('GMAIL_USER');
  if (!pass || pass === 'your-16-character-app-password') missing.push('GMAIL_APP_PASSWORD');
  return { user, pass, from, missing };
}

export function isMailConfigured() {
  return readMailConfig().missing.length === 0;
}

function getTransporter() {
  if (transporter) return transporter;
  const { user, pass, missing } = readMailConfig();
  if (missing.length) {
    throw new MailError('MAIL_NOT_CONFIGURED',
      `Gmail SMTP is not configured. Set ${missing.join(' and ')} in .env and restart the server.`);
  }
  if (pass.length !== 16) {
    throw new MailError('MAIL_NOT_CONFIGURED',
      'GMAIL_APP_PASSWORD must be the 16-character Google App Password, not your normal Gmail password.');
  }
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  return transporter;
}

function toMailError(error) {
  if (error instanceof MailError) return error;
  if (error.code === 'EAUTH' || error.responseCode === 535 || error.responseCode === 534) {
    transporter = null;
    return new MailError('MAIL_AUTH_FAILED',
      'Gmail rejected the login. Check GMAIL_USER and that GMAIL_APP_PASSWORD is a valid App Password (2-Step Verification must be on).',
      { cause: error });
  }
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ECONNREFUSED'].includes(error.code)) {
    transporter = null;
    return new MailError('MAIL_UNREACHABLE',
      'The server could not reach smtp.gmail.com. Check the internet connection or firewall (port 465).',
      { cause: error });
  }
  if (error.responseCode >= 500 && error.responseCode < 600) {
    return new MailError('MAIL_REJECTED', 'Gmail refused to deliver the message to that address.', { cause: error });
  }
  return new MailError('MAIL_FAILED', 'The confirmation email could not be sent.', { cause: error });
}

export async function verifyMail() {
  try {
    await getTransporter().verify();
  } catch (error) {
    throw toMailError(error);
  }
}

export async function sendMail(message) {
  const { from } = readMailConfig();
  try {
    return await getTransporter().sendMail({ from, ...message });
  } catch (error) {
    throw toMailError(error);
  }
}

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

export async function sendPaymentReceipt(receipt) {
  const money = value => `ZMW ${Number(value).toLocaleString('en-ZM', { maximumFractionDigits: 2 })}`;
  const paidAt = new Date(receipt.paidAt).toLocaleString('en-GB', { timeZone: 'Africa/Lusaka' });
  const textLines = receipt.lines
    .map(line => `  ${line.quantity} x ${line.name} — ${money(line.lineTotal)}`)
    .join('\n');
  const htmlRows = receipt.lines
    .map(line => `<tr><td>${line.quantity} × ${escapeHtml(line.name)}</td><td align="right">${money(line.lineTotal)}</td></tr>`)
    .join('');
  const deliveryNote = receipt.deliveryNote ? ` (${receipt.deliveryNote})` : '';

  return sendMail({
    to: receipt.email,
    subject: `UniBasket Zambia payment receipt ${receipt.orderId}`,
    text: `Hi ${receipt.name},\n\nThank you for your order. Your demonstration payment was successful.\n\n` +
      `Order reference: ${receipt.orderId}\nPayment reference: ${receipt.paymentRef}\n` +
      `Paid with: ${receipt.paymentMethod}\nDate: ${paidAt}\n\n` +
      `Items:\n${textLines}\n\nSubtotal: ${money(receipt.subtotal)}\n` +
      `Delivery: ${receipt.deliveryMethod}${deliveryNote} — ${money(receipt.deliveryCharge)}\n` +
      `Total paid: ${money(receipt.total)}\n\n` +
      `This is a demonstration receipt. No real payment was processed.\n\nUniBasket Zambia\n${appUrl}`,
    html: `<p>Hi ${escapeHtml(receipt.name)},</p>` +
      `<p>Thank you for your order. Your demonstration payment was successful.</p>` +
      `<p><strong>Order reference:</strong> ${escapeHtml(receipt.orderId)}<br>` +
      `<strong>Payment reference:</strong> ${escapeHtml(receipt.paymentRef)}<br>` +
      `<strong>Paid with:</strong> ${escapeHtml(receipt.paymentMethod)}<br>` +
      `<strong>Date:</strong> ${escapeHtml(paidAt)}</p>` +
      `<table cellpadding="6" style="border-collapse:collapse;min-width:320px">${htmlRows}` +
      `<tr><td>Subtotal</td><td align="right">${money(receipt.subtotal)}</td></tr>` +
      `<tr><td>Delivery: ${escapeHtml(receipt.deliveryMethod + deliveryNote)}</td><td align="right">${money(receipt.deliveryCharge)}</td></tr>` +
      `<tr><td><strong>Total paid</strong></td><td align="right"><strong>${money(receipt.total)}</strong></td></tr></table>` +
      `<p style="color:#666">This is a demonstration receipt. No real payment was processed.</p>` +
      `<p>UniBasket Zambia<br><a href="${escapeHtml(appUrl)}">${escapeHtml(appUrl)}</a></p>`,
  });
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
