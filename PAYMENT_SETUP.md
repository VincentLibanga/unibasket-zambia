# Flutterwave payment setup

UniBasket integrates Flutterwave Standard v3 hosted checkout in ZMW. The provider handles card details and mobile-money authorization. UniBasket uses the server API to generate checkout links and verify payments. It does not collect card details or phone PINs.

## 1. Create your provider account

Create an account through [Flutterwave Zambia](https://flutterwave.com/zm/), then use the dashboard's test mode. Account registration and business verification must be completed by the account owner. Follow the provider's [Standard checkout guide](https://developer.flutterwave.com/docs/flutterwave-standard-1) for API access.

Retrieve your **v3 test secret key** from the API settings. Hosted checkout does not require a public key or encryption key in this application. Keep the secret key in the local `.env` file; never put it in `public/` or send it in chat.

### Try the public sandbox example while awaiting account access

Flutterwave's [Zambia Mobile Money API reference](https://developer.flutterwave.com/reference/charge-via-zambia-mobile-money) supplies a public documentation demo key. On 5 November 2026, the following sample request returned HTTP 200 with `status: "success"`, `message: "Charge initiated"` and a `meta.authorization.redirect` test authorization URL:

```sh
curl --request POST \
  --url 'https://api.flutterwave.com/v3/charges?type=mobile_money_zambia' \
  --header 'Authorization: Bearer FLWSECK_TEST-SANDBOXDEMOKEY-X' \
  --header 'Content-Type: application/json' \
  --header 'accept: application/json' \
  --data '{
    "amount": 1500,
    "currency": "ZMW",
    "email": "user@flw.com",
    "tx_ref": "MC-3243e",
    "network": "MTN",
    "phone_number": "054709929220",
    "order_id": "URF_MMGH_1585323540079_5981535",
    "fullname": "John Doe",
    "client_ip": "154.123.220.1",
    "device_fingerprint": "62wd23423rq324323qew1"
  }'
```

These are the provider's sample values, not customer details. This public demo request can test charge initiation without your own account key. It does not establish that payment completed, that the merchant account is active, or that the website's checkout and verification work with this shared key. Follow the returned test authorization URL and independently verify the transaction before treating a payment as successful. Use a fresh unique `tx_ref` for each new transaction in your own integration.

The website currently uses Standard hosted checkout, a different initiation endpoint (`POST /v3/payments`). Use your own account's test key for its full checkout, webhook and verification tests. The public documentation demo key is not a merchant credential for collecting real payments.

## 2. Configure the server

Set these values in `.env`:

```dotenv
PAYMENT_MODE=test
FLW_SECRET_KEY=your-v3-test-secret-key
FLW_WEBHOOK_SECRET=your-random-webhook-secret-at-least-24-characters
APP_URL=http://127.0.0.1:4176
DATABASE_URL=your-supabase-postgres-connection-string
```

Test keys start with `FLWSECK_TEST-`. The application rejects live keys in test mode. Generate a random webhook secret and enter exactly the same value in the Flutterwave dashboard's webhook secret hash field. If a secret has already been generated in `.env`, use that value.

The database is required for online payment. It stores authoritative catalogue prices and durable payment records. A static catalogue preview alone cannot accept online payments. Existing `SMTP_*` settings deliver paid receipts; an email outage does not reverse a verified payment.

For a new database, run `npm run db:setup`. For an existing UniBasket catalogue, run:

```sh
npm run db:payments
npm start
```

The payment-only setup creates the payment table without reseeding or changing existing catalogue items. Alternatively, execute `database/payments.sql` in the Supabase SQL Editor. Remote Postgres connections continue to require certificate verification as described in README.md.

## 3. Configure payment notifications

For a publicly accessible installation, set `APP_URL` to its HTTPS address and configure this webhook URL in Flutterwave:

```text
https://your-domain.com/api/payments/webhook
```

Enable webhook retries. A localhost address cannot receive provider webhooks. Local test checkout can still return to the browser and use **Check payment status**. A public HTTPS deployment is needed to test asynchronous webhook delivery.

The v3 webhook uses the `verif-hash` header. The server compares it to the configured secret, then independently queries Flutterwave by the order reference. Webhook fields and browser return parameters alone never confirm payment. See the provider's [webhook documentation](https://developer.flutterwave.com/docs/webhooks) and [verification endpoint](https://developer.flutterwave.com/reference/verify-transaction-with-tx_ref).

## 4. Test the website

1. Start the app and open its configured address.
2. Sign in to a demonstration account and add a shared catalogue product to the basket.
3. Choose delivery details and select **Pay online · Test mode**.
4. Complete the provider's test checkout using the test payment details supplied by its dashboard/documentation.
5. Return to UniBasket. It verifies the reference, ZMW currency, exact amount and buyer email before showing **Paid (test)**.
6. Test pending and failed transactions. Pending orders remain accessible through **Basket → Resume payment**. The basket is cleared only after verified payment.

Available methods depend on the merchant account and its dashboard settings. Flutterwave documents [Zambian mobile money](https://developer.flutterwave.com/docs/zambia-mobile-money) and requires its payment method to be enabled on the account. No real money should be used with test credentials.

## Implementation and boundaries

- `POST /api/payments/initiate` accepts product IDs and quantities; names, prices and delivery charges come from server data.
- Repeating a private request key returns the same durable order. Concurrent requests claim one checkout initialization.
- `POST /api/payments/:reference/verify` requires that private key in `Authorization: Bearer ...`. Only its hash is stored in the database. Return to the same browser tab, whose session storage holds the key.
- The verification API's response is checked against the order snapshot. A paid order cannot be downgraded by later failed notifications.
- If initialization times out, the existing reference is kept and another checkout is not automatically created. Use status checks and, if necessary, inspect that reference in the provider dashboard before arranging a new attempt.
- Paid receipts are retried when checking status or receiving another webhook. The database prevents concurrent sends. A process crash after SMTP accepts an email but before the database records delivery can still result in a duplicate email on retry.
- Browser-only seller listings use the unpaid email-order option because their prices are not stored in the shared catalogue.
- Buyer and seller authentication remains a browser demonstration. This change does not implement database-backed accounts, fulfillment or stock reservations. A real shop still needs server authentication and an inventory/fulfillment workflow before enabling live payments. Live configuration requires `PAYMENT_MODE=live`, a matching live key and a public HTTPS `APP_URL`; do not use that configuration for coursework testing.

## Verification

Run `npm run check` and `npm test`. Payment tests use an isolated PostgreSQL-compatible database and mocked gateway responses. They do not create actual Flutterwave transactions or prove that provider credentials, account approval, webhooks or real payment methods are active.
