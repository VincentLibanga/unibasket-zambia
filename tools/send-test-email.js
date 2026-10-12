import { sendMail, verifyMail } from '../mail.js';

const to = process.argv[2] || process.env.GMAIL_USER;
if (!to) {
  console.error('Usage: npm run mail:test -- recipient@example.com');
  process.exit(1);
}

try {
  await verifyMail();
  console.log('Gmail SMTP login verified.');
  const info = await sendMail({
    to,
    subject: 'UniBasket Zambia SMTP test',
    text: 'If you can read this, Gmail SMTP is working for UniBasket Zambia.',
  });
  console.log(`Test email sent to ${to} (${info.messageId}).`);
} catch (error) {
  console.error(`${error.code || 'ERROR'}: ${error.message}`);
  if (error.cause) console.error(`Details: ${error.cause.message}`);
  process.exitCode = 1;
}
