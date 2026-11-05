# UniBasket Task 3 Submission

This submission implements Task 3: insert and display products and categories. It keeps the existing HTML, CSS and JavaScript interface and adds a Node.js 24 LTS and Express 5 backend connected to Supabase Postgres through `pg` (node-postgres).

## Included work

- Five database-backed categories
- Seventy-two database-backed products
- Category and product REST API endpoints
- API-connected frontend with a local fallback for static layout preview
- Existing search, category filter, price sorting and responsive product cards
- Always-visible search bar and collapsible small-screen menu for navigation, account and basket
- Stable product IDs for later cart work
- Buyer and Seller account areas selected during registration, with browser-saved seller product listings
- Bundled representative imagery for all 72 catalogue items, including 52 user-supplied images
- Seller photo upload for new browser-saved listings
- Route-based marketplace views for Home, Products, Categories, Account, Seller and Basket
- Supabase Postgres schema, repeatable seed data and setup command

Buyer and seller accounts and listings remain browser-only demonstrations. Checkout submits mobile-money requests and queries their status through ZynlePay's sandbox using the Node.js server. Final payment confirmation still requires documented success responses, so an unconfirmed request stays pending. During registration, a user selects either Buyer account or Seller account. The account page lets the user update their displayed name. Checkout requires sign-in and uses that profile name on the order confirmation. Seller listings are saved in the current browser and appear in the catalogue for that browser; a shared database seller catalogue can be added in a later backend milestone.

The catalogue images are stored in `public/images/products`, so they display without a live image service. Fifty-two user-supplied AI-generated images have been matched to catalogue items and resized for web display. The remaining items retain representative licensed photos. The UniBasket product brand names are fictional; images illustrate the product type and do not claim to show that exact brand or package. Image provenance and available license details are listed in `PHOTO_CREDITS.md` and linked from the website footer. Sellers can upload a photo when publishing a listing; their listing and its photo are stored only in the current browser.

The navigation uses page routes such as `?page=products`, `?page=categories`, `?page=account` and `?page=basket`, so the site behaves as one connected marketplace while each public area has its own URL state. Seller tools are shown only to accounts registered as sellers.

Browser-saved accounts are tied to the exact site origin, including its port. An account created at `127.0.0.1:4176` is not available at `127.0.0.1:4178`; use the same address and port when returning to an account. Checkout is a test flow and does not process a real payment.

When the API is available, public/script.js loads categories from `/api/categories` and products from `/api/products?limit=100`. If the backend or database is unavailable, the same layout falls back to its local preview data so the HTML, CSS and JavaScript can still be demonstrated.

## Requirements

- Node.js 24 LTS
- A Supabase project with its Postgres connection string
- npm

## Setup

1. Extract the submission folder.
2. Open a terminal in the project folder.
3. Run `npm install`.
4. For a new installation, copy `.env.example` to `.env`. If `.env` already exists, keep its mail and payment settings and add the database variables below.
5. In your Supabase project, choose **Connect → Session pooler** and copy the Postgres URI. Replace `[YOUR-PASSWORD]` with the project's database password and percent-encode reserved password characters. Set the complete URI as `DATABASE_URL` in `.env`. Use the exact host, port, database and username from the dashboard; the application no longer uses `DB_HOST`, `DB_USER`, `DB_PASSWORD`, or `DB_NAME`.
6. Remote connections require TLS with certificate and hostname verification. If the database certificate is not trusted by your system, download the CA certificate from the Supabase database settings and set `DATABASE_SSL_CA_FILE` to its local file path. Do not commit the database URI or certificate.
7. Run `npm run db:setup`. It creates the catalogue tables and seeds five categories and 72 products in the database selected by `DATABASE_URL`. Repeating this command updates those catalogue IDs without duplicating rows. Schema and seed run in a single transaction.
8. Run `npm start`.
9. Open `http://127.0.0.1:4176/`.

For an existing Express server, Supabase's session pooler also works on IPv4-only networks. See the [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres) for direct and pooled connection options. A project URL or publishable API key is not a Postgres connection string.

Alternatively, run `database/schema.sql` followed by `database/seed.sql` in the project's Supabase SQL Editor, then configure `DATABASE_URL` for the server. The SQL uses the project's existing database; it does not create a separate `unibasket` database. The seed restores the bundled catalogue; any additional rows in an old MySQL database need a separate data export and import.

Row level security is enabled on both tables with no browser-facing policies. The Express backend uses its private database connection; Supabase API keys and the database password are never sent to the browser. This database migration covers categories and products. Accounts, seller listings and sandbox payment snapshots keep the storage behavior described below.

## API checks

- `http://127.0.0.1:4176/api/health`
- `http://127.0.0.1:4176/api/categories`
- `http://127.0.0.1:4176/api/products`
- `http://127.0.0.1:4176/api/products?category=essential-groceries`
- `http://127.0.0.1:4176/api/products?search=oats&sort=price_asc`

## Account confirmation email

Registration sends a confirmation email through your configured SMTP provider before the account is saved. Set these server-only values in `.env` using the details supplied by the email provider:

```dotenv
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password-or-api-key
MAIL_FROM="UniBasket Zambia <sender@your-verified-domain.com>"
```

`MAIL_FROM` controls the sender address used for confirmations, password reset codes and payment receipts. It can differ from the SMTP login, and must be allowed by your provider. Set `APP_URL` to the app's address. Passwords are kept exactly as entered; generic SMTP passwords are not restricted to 16 characters.

Use `SMTP_SECURE=true` for immediate TLS, normally on port 465. For STARTTLS, normally port 587, use `SMTP_SECURE=false`; the application requires an encrypted upgrade before authentication. Certificate verification stays enabled. See the [Nodemailer SMTP documentation](https://nodemailer.com/smtp) for the transport options.

Restart `npm start` after changing `.env`. Startup verifies the connection and login without sending an email. To send an explicit delivery test, run `npm run mail:test -- recipient@example.com`; a recipient is required. A successful login check does not establish that the provider will accept a particular sender address.

Existing `GMAIL_USER` and `GMAIL_APP_PASSWORD` settings remain compatible when no generic `SMTP_*` values are set. That legacy mode uses Gmail on port 465 and removes the spaces Google inserts into App Passwords. Configuring any generic SMTP setting selects the new configuration and requires its own host and credentials; it never falls back to a Gmail password for a different provider. The old `MAIL_HOST` field cannot redirect legacy Gmail credentials to another server.

## Forgot password

Choose **Forgot password?** on the sign-in screen, enter the email used to register, and enter the emailed six-digit code alongside your new password. Codes expire after 10 minutes, are single use, and allow five attempts. Requesting a new code invalidates the previous code. Email requests are limited to three per address per hour, with at least one minute between requests, and ten per client IP per hour.

Accounts still live in browser storage: use the same browser and site address where you registered. Resetting a password preserves the account name, role, and seller listings. The password is hashed in the browser and is never sent to the reset API. Reset codes are held in server memory, so restarting the server invalidates outstanding codes. SMTP must be configured to deliver them.

If you originally registered by opening `public/index.html` as a `file:///` URL, reopen that exact file in the same browser and refresh it. Click **Move saved accounts** in the account panel. This opens the running app at `http://127.0.0.1:4176/` and copies your accounts and seller listings into its browser storage. Existing destination accounts are preserved, and the original file-preview data is retained. The new tab opens the password reset form with the transferred email filled in. The transfer stays between the two browser tabs; it does not upload account records to the server.

## ZynlePay sandbox payments

Checkout submits mobile-money requests using the supplied `runBillPayment` JSON contract. The manual approve, decline and cancel controls have been removed. Card testing is disabled until its request/redirect contract is available.

### Configuration

Create a [ZynlePay sandbox account](https://sandbox.zynlepay.com/register), enable a mobile-money simulator for a test phone number, and put the matching sandbox credentials in the ignored local `.env`:

```dotenv
ZYNLEPAY_SANDBOX_API_URL=https://sandbox.zynlepay.com/zynlepay/jsonapi
ZYNLEPAY_SANDBOX_MERCHANT_CODE=your-merchant-code
ZYNLEPAY_SANDBOX_API_ID=your-sandbox-api-id
ZYNLEPAY_SANDBOX_API_KEY=your-sandbox-api-key
```

Restart `npm start`, open the same localhost address where you registered, add a product, sign in, and choose **Pay with ZynlePay**. Use a number configured in your own sandbox simulator. Open **Simulator** in the ZynlePay dashboard to respond to the payment prompt using its test PIN. The observed sandbox prompt appeared in that browser simulator; a real handset prompt has not been verified. Local `07`/`09` numbers and `+260` numbers are normalized to `260` followed by the nine-digit mobile number. No test phone numbers or real credentials are committed to this repository.

If a sandbox key is regenerated in ZynlePay, update `ZYNLEPAY_SANDBOX_API_KEY` in `.env` and restart the app. The old key will not authenticate.

The server accepts only the sandbox URL above, optionally with a trailing slash. A production URL or different host is rejected before credentials can be sent. The API key and API ID remain on the server.

The outgoing request is:

```json
{
  "auth": {
    "merchant_id": "from local environment",
    "api_id": "from local environment",
    "api_key": "from local environment",
    "channel": "momo"
  },
  "data": {
    "method": "runBillPayment",
    "receiver_id": "260XXXXXXXXX",
    "reference_no": "unique checkout reference",
    "amount": "total including delivery, in ZMW"
  }
}
```

### Request handling and confirmation limits

`POST /api/payments/checkout` validates and snapshots the basket, calculates delivery, and returns a unique reference and private verification token before any gateway submission. The browser saves that reference in session storage, then calls `POST /api/payments/initiate`. Concurrent and repeated initiation requests submit only one charge for the same reference. A timeout retains the pending reference and never resubmits the charge automatically.

ZynlePay response `2000` (no active simulator) and `9902` (wrong API credentials) are handled as definite failures. Checkout preserves the basket and shows clear feedback. These are gateway responses; an HTTP 200 alone never confirms payment. A missing simulator response may occur before authentication is checked.

A real sandbox request with the updated key returned `120` (`Transaction is initiated`) and a numeric transaction ID. The service retains that ID and displays it alongside the order reference while keeping the payment pending. This response does not establish a completed payment.

`POST /api/payments/verify` now queries the documented sandbox status endpoint, `https://sandbox.zynlepay.com/zynlepay/jsonapi/paymentstatus`, using this separate, flat request body:

```json
{
  "api_id": "from local environment",
  "api_key": "from local environment",
  "reference_no": "saved checkout reference"
}
```

The earlier ZMW 1 status query returned code `995` with a matching reference. A code-only response does not confirm payment, including codes `120`, `130`, and `995`. It stays pending until the complete terminal result is received. Each **Check payment status** queries the same saved reference, and concurrent checks share one provider request. The status adapter also accepts a complete terminal payload matching the callback contract below when the authenticated status endpoint returns one. It does not guess a paid status from descriptions or HTTP 200.

### Merchant callback

The callback endpoint is `POST /api/payments/callback?token=YOUR-PRIVATE-CALLBACK-SECRET`. Set `ZYNLEPAY_CALLBACK_SECRET` in the server's `.env` to 64 random hexadecimal characters (32 random bytes). A private secret was generated for the existing local installation during this update; fresh installations must generate their own. It is separate from the ZynlePay API key and the buyer's verification token.

In the ZynlePay merchant settings, configure the full callback URL on the application's publicly reachable HTTPS host, including its private `token` query parameter. Treat that URL as a credential. The supplied callback format does not document a signature, so this application authenticates its configured URL token before processing the body. A localhost URL cannot receive callbacks from the provider. The app does not open a public tunnel automatically.

The supplied callback fields are validated as follows:

- `isAcknowledged` must be `true` and `reference_no` must identify a checkout that was submitted for payment.
- `amount` and normalized `phone` must match the stored checkout. The adapter supports this shop's ZMW sandbox contract; the supplied callback omits currency, and an explicit currency other than `ZMW` is rejected.
- `transaction_status: "SUCCESS"` requires `transaction_result.code: "100"`. A consistent `FAILED` result records a failure and preserves the basket. Contradictory or incomplete results are rejected.
- `operator_reference` identifies repeated callbacks. A conflicting later callback cannot overwrite a recorded result. `merchant_callback_url` in the body is metadata and is never fetched or used to authenticate a request.

After authentication and validation, the merchant response is the supplied acknowledgement, without an extra `data` wrapper:

```json
{ "response_code": "130", "reference_no": "the matching checkout reference" }
```

Receipt delivery runs after the callback is recorded, so acknowledgements do not wait for SMTP. Repeated callbacks, concurrent status checks, and callbacks that arrive before the initiation response share one settlement and send at most one receipt. The browser retrieves the final result through its private `/api/payments/verify` request. A receipt email failure does not undo a confirmed payment.

Checkout displays campus delivery at ZMW 25 and courier delivery at ZMW 50. A pending checkout saves its original server-quoted total and quantities, so reloading the page does not replace them with an empty basket total.

This remains a sandbox demonstration: accounts and seller prices originate in browser storage, and checkout snapshots are kept in server memory for up to 24 hours. Server restarts clear them; check the sandbox dashboard before repeating an interrupted payment. Live payments require server-owned accounts, catalogue pricing and durable order storage. The integration cannot process live payments.

The category endpoint should return five categories. The products endpoint should return 72 products when no filter is supplied.

## Verification commands

- `npm run check`
- `npm test`

The database tests use an isolated PGlite PostgreSQL engine to execute the actual schema, seed and API queries. They check repeatable setup, generated IDs, constraints, row level security, search, filtering, sorting and pagination without connecting to your Supabase project.

Database credentials belong only in `.env`. Do not place them in `public/script.js` or submit a real password in `.env.example`.
