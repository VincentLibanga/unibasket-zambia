# Email receipts and ZynlePay sandbox

Checkout provides two separate choices:

- **Place order & email receipt** creates an unpaid order and emails its itemized confirmation. It does not collect money.
- **Pay with ZynlePay · Sandbox** submits a mobile-money simulator request and lets the buyer check the same payment reference. It cannot collect live payments.

The previous SMTP and ZynlePay sandbox settings have been restored in the ignored local `.env`. Credentials are never committed or returned to the browser.

## Email order receipts

Keep your existing `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `MAIL_FROM` settings. Registration, password reset and order receipts use the same configured sender.

Sign in, add products, choose delivery details and select **Place order & email receipt**. The receipt is sent to the signed-in buyer. A simulator phone number is not required for this option. If delivery fails, **Retry email confirmation** reuses the same request key and basket snapshot. The basket is cleared only after SMTP accepts the confirmation.

While a ZynlePay request is pending, **Email an unpaid order confirmation** returns to the email checkout and preserves the sandbox reference. That email explicitly states **Unpaid**. It does not establish the status of the separate sandbox request.

## ZynlePay sandbox settings

Use your [ZynlePay sandbox account](https://sandbox.zynlepay.com/) and configure a mobile-money simulator for the test number. Keep these values on the server:

```dotenv
PAYMENT_MODE=test
ZYNLEPAY_SANDBOX_API_URL=https://sandbox.zynlepay.com/zynlepay/jsonapi
ZYNLEPAY_SANDBOX_MERCHANT_CODE=your-merchant-code
ZYNLEPAY_SANDBOX_API_ID=your-sandbox-api-id
ZYNLEPAY_SANDBOX_API_KEY=your-sandbox-api-key
```

Only the exact HTTPS sandbox API address is accepted. A production URL, different host or live payment mode is rejected before sending credentials. The application never asks for a mobile-money PIN. Complete simulator authorization in the ZynlePay sandbox dashboard.

Online sandbox checkout uses the shared database catalogue for product prices and stock checks. Configure `DATABASE_URL` for a local PostgreSQL development database or Supabase. For a fresh database, run `npm run db:setup`; for an existing catalogue, `npm run db:payments` creates the payment table without reseeding products. Restart `npm start` after changing `.env`.

## Test checkout

1. Open `http://127.0.0.1:4176/`, sign in and add a shared catalogue product.
2. Choose delivery details and enter the mobile number configured in your ZynlePay simulator.
3. Select **Pay with ZynlePay · Sandbox**.
4. Respond to the request in the sandbox simulator, then use **Check payment status** on UniBasket.
5. Keep the order reference if the result remains pending. Repeated checks query the same reference; they do not submit another charge.

Local `07`/`09` numbers and `+260` numbers are normalized to `260` followed by the nine-digit mobile number. The form's phone field is optional when choosing an email order instead.

## Payment confirmation limits

The restored initiation contract posts `runBillPayment` with a merchant/API authentication object, simulator number, unique reference and total. The status query uses the separate `/paymentstatus` endpoint with a flat `api_id`, `api_key` and `reference_no` body.

The earlier sandbox integration observed response `120` for **Transaction is initiated**. This establishes submission only. Response `2000` identifies a missing simulator and `9902` identifies invalid sandbox credentials; both are shown as failed initiation attempts. The status endpoint previously returned `995` with an unconfirmed completion message.

The successful terminal status contract has not been verified. The adapter therefore keeps status responses pending with `confirmationAvailable: false`; neither HTTP 200 nor a success-like response message marks an order paid. The buyer can still choose the independent unpaid email confirmation. There is no active webhook endpoint, and browser return parameters cannot confirm payment.

The checkout service has tested support for independently verified terminal data, but the real adapter will require the provider's confirmed success contract before enabling it. It must verify the reference, exact ZMW amount and transaction ID. Paid-receipt email failures must not undo a verified payment.

## Storage and verification

Sandbox requests are saved in the private `payment_orders` table. Repeated private request keys share one checkout initialization, and uncertain responses never automatically resubmit a charge. Only the request key's hash is stored on the server. The browser retains the key in session storage, so use the same browser tab to resume a request.

Existing Flutterwave records and saved browser data are not submitted to ZynlePay. Browser-only seller listings can use the email order option. Accounts remain browser demonstrations, and stock reservations and fulfillment are not implemented.

Run `npm run check` and `npm test`. Automated payment tests use an isolated database and mocked gateway responses. They do not send payments or email. An SMTP login check verifies authentication but does not guarantee inbox delivery.
