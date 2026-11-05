# UniBasket Zambia

This project includes a product catalogue, shopping basket, browser-saved demonstration accounts, email order receipts and ZynlePay sandbox payments. It uses HTML, CSS and JavaScript with a Node.js 24 LTS and Express 5 backend connected to PostgreSQL through `pg` (node-postgres).

## Included work

- Five database-backed categories
- Seventy-two database-backed products
- Category and product REST API endpoints
- API-connected frontend with a local fallback for static layout preview
- Existing search, category filter, price sorting and responsive product cards
- Always-visible search and basket controls, with a compact small-screen menu for navigation and account access
- Stable product IDs for later cart work
- Buyer and Seller account areas selected during registration, with browser-saved seller product listings
- Bundled representative imagery for all 72 catalogue items, including 52 user-supplied images
- Seller photo upload for new browser-saved listings
- Route-based marketplace views for Home, Products, Categories, Account, Seller and Basket
- Supabase Postgres schema, repeatable seed data and setup command

Buyer and seller accounts and listings remain browser-only demonstrations. Checkout offers ZynlePay sandbox mobile-money requests for shared catalogue items and a separate unpaid email-order option. Sandbox amounts come from the database and payment records are durable. The restored gateway adapter keeps status responses unconfirmed until the provider's successful terminal response contract is verified; it never assumes a submitted request is paid. Email order receipts remain available independently. See [PAYMENT_SETUP.md](PAYMENT_SETUP.md). During registration, a user selects either Buyer account or Seller account. The account page lets the user update their displayed name. Seller listings are saved in the current browser and appear in the catalogue for that browser; they can use the unpaid email-order option.

The catalogue images are stored in `public/images/products`, so they display without a live image service. Fifty-two user-supplied AI-generated images have been matched to catalogue items and resized for web display. The remaining items retain representative licensed photos. The UniBasket product brand names are fictional; images illustrate the product type and do not claim to show that exact brand or package. Image provenance and available license details are listed in `PHOTO_CREDITS.md` and linked from the website footer. Sellers can upload a photo when publishing a listing; their listing and its photo are stored only in the current browser.

The navigation uses page routes such as `?page=products`, `?page=categories`, `?page=account` and `?page=basket`, so the site behaves as one connected marketplace while each public area has its own URL state. Seller tools are shown only to accounts registered as sellers.

Browser-saved accounts are tied to the exact site origin, including its port. An account created at `127.0.0.1:4176` is not available at `127.0.0.1:4178`; use the same address and port when returning to an account. ZynlePay sandbox requests resume in the same browser tab using a private request key in session storage. Gateway credentials stay on the server.

Successful sign-in and registration return to the home page and close the account panel. The basket stays available on small screens, with quantity controls, item removal and a checkout summary that remains visible while items scroll. A saved unfinished email confirmation can also be resumed from an empty basket.

When the API is available, public/script.js loads categories from `/api/categories` and products from `/api/products?limit=100`. If the backend or database is unavailable, the same layout falls back to its local preview data so the HTML, CSS and JavaScript can still be demonstrated.

## Requirements

- Node.js 24 LTS
- A Supabase project with its Postgres connection string
- npm

## Setup

1. Extract the submission folder.
2. Open a terminal in the project folder.
3. Run `npm install`.
4. For a new installation, copy `.env.example` to `.env`. If `.env` already exists, keep its mail settings and add the database variables below.
5. In your Supabase project, choose **Connect → Session pooler** and copy the Postgres URI. Replace `[YOUR-PASSWORD]` with the project's database password and percent-encode reserved password characters. Set the complete URI as `DATABASE_URL` in `.env`. Use the exact host, port, database and username from the dashboard; the application no longer uses `DB_HOST`, `DB_USER`, `DB_PASSWORD`, or `DB_NAME`.
6. Remote connections require TLS with certificate and hostname verification. If the database certificate is not trusted by your system, download the CA certificate from the Supabase database settings and set `DATABASE_SSL_CA_FILE` to its local file path. Do not commit the database URI or certificate.
7. Run `npm run db:setup`. It creates the catalogue tables and seeds five categories and 72 products in the database selected by `DATABASE_URL`. Repeating this command updates those catalogue IDs without duplicating rows. Schema and seed run in a single transaction.
8. Run `npm start`.
9. Open `http://127.0.0.1:4176/`.

For an existing Express server, Supabase's session pooler also works on IPv4-only networks. See the [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres) for direct and pooled connection options. A project URL or publishable API key is not a Postgres connection string.

Alternatively, run `database/schema.sql`, `database/payments.sql` and `database/seed.sql` in the project's Supabase SQL Editor, then configure `DATABASE_URL` for the server. The SQL uses the project's existing database; it does not create a separate `unibasket` database. The seed restores the bundled catalogue; any additional rows in an old MySQL database need a separate data export and import.

Row level security is enabled on catalogue and payment tables with no browser-facing policies. The Express backend uses its private database connection; Supabase API keys and the database password are never sent to the browser. Accounts, seller listings and unpaid email-order snapshots keep the storage behavior described below. Online payment records use the durable `payment_orders` table.

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

`MAIL_FROM` controls the sender address used for confirmations, password reset codes and order receipts. It can differ from the SMTP login, and must be allowed by your provider. Set `APP_URL` to the app's address. Passwords are kept exactly as entered; generic SMTP passwords are not restricted to 16 characters.

Use `SMTP_SECURE=true` for immediate TLS, normally on port 465. For STARTTLS, normally port 587, use `SMTP_SECURE=false`; the application requires an encrypted upgrade before authentication. Certificate verification stays enabled. See the [Nodemailer SMTP documentation](https://nodemailer.com/smtp) for the transport options.

Restart `npm start` after changing `.env`. Startup verifies the connection and login without sending an email. To send an explicit delivery test, run `npm run mail:test -- recipient@example.com`; a recipient is required. A successful login check does not establish that the provider will accept a particular sender address.

Existing `GMAIL_USER` and `GMAIL_APP_PASSWORD` settings remain compatible when no generic `SMTP_*` values are set. That legacy mode uses Gmail on port 465 and removes the spaces Google inserts into App Passwords. Configuring any generic SMTP setting selects the new configuration and requires its own host and credentials; it never falls back to a Gmail password for a different provider. The old `MAIL_HOST` field cannot redirect legacy Gmail credentials to another server.

## Forgot password

Choose **Forgot password?** on the sign-in screen, enter the email used to register, and enter the emailed six-digit code alongside your new password. Codes expire after 10 minutes, are single use, and allow five attempts. Requesting a new code invalidates the previous code. Email requests are limited to three per address per hour, with at least one minute between requests, and ten per client IP per hour.

Accounts still live in browser storage: use the same browser and site address where you registered. Resetting a password preserves the account name, role, and seller listings. The password is hashed in the browser and is never sent to the reset API. Reset codes are held in server memory, so restarting the server invalidates outstanding codes. SMTP must be configured to deliver them.

If you originally registered by opening `public/index.html` as a `file:///` URL, reopen that exact file in the same browser and refresh it. Click **Move saved accounts** in the account panel. This opens the running app at `http://127.0.0.1:4176/` and copies your accounts and seller listings into its browser storage. Existing destination accounts are preserved, and the original file-preview data is retained. The new tab opens the password reset form with the transferred email filled in. The transfer stays between the two browser tabs; it does not upload account records to the server.

## Unpaid email order confirmation

Add products, sign in, open checkout, and choose a delivery method. The receipt destination is the signed-in account's email. Choose **Place order & email receipt** to submit `POST /api/orders`. No phone PIN, payment method, gateway account or API key is needed.

The server validates the order and calculates delivery and totals in whole cents. Delivery remains ZMW 25 for campus drop-off, free for collection, and ZMW 50 for city courier. The emailed receipt includes the buyer's name, order reference, date in Lusaka time, quantities, item totals, delivery details and order total. Both the email and confirmation screen explicitly show **Unpaid** and say that no payment was collected.

Checkout shows success and removes the submitted basket quantities only after SMTP accepts the receipt. If email fails, the basket is retained and **Retry email confirmation** uses the same saved order details and request key. Concurrent submissions and retries after a lost HTTP response share one order reference and do not send another receipt once the first send has succeeded. Correctable validation errors unlock the form for editing.

Unfinished confirmations are saved in the browser tab's session storage. Server deduplication records stay in memory for up to 24 hours; restarting the server clears them. This remains a demonstration with browser-saved accounts and seller prices, rather than a durable shared order-management system. SMTP acceptance does not guarantee inbox placement; check spam if an email is missing.

The category endpoint should return five categories. The products endpoint should return 72 products when no filter is supplied.

## Verification commands

- `npm run check`
- `npm test`

The database tests use an isolated PGlite PostgreSQL engine to execute the actual schema, seed and API queries. They check repeatable setup, generated IDs, constraints, row level security, search, filtering, sorting and pagination without connecting to your Supabase project.

Database credentials belong only in `.env`. Do not place them in `public/script.js` or submit a real password in `.env.example`.
