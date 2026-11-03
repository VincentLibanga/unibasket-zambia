# UniBasket Task 3 Submission

This submission implements Task 3: insert and display products and categories. It keeps the existing HTML, CSS and JavaScript interface and adds a Node.js 24 LTS and Express 5 backend connected to MySQL 8.4 LTS through `mysql2/promise`.

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
- MySQL schema, repeatable seed data and setup command

Buyer and seller accounts and listings remain browser-only demonstrations. Checkout submits mobile-money requests and queries their status through ZynlePay's sandbox using the Node.js server. Final payment confirmation still requires documented success responses, so an unconfirmed request stays pending. During registration, a user selects either Buyer account or Seller account. The account page lets the user update their displayed name. Checkout requires sign-in and uses that profile name on the order confirmation. Seller listings are saved in the current browser and appear in the catalogue for that browser; a shared database seller catalogue can be added in a later backend milestone.

The catalogue images are stored in `public/images/products`, so they display without a live image service. Fifty-two user-supplied AI-generated images have been matched to catalogue items and resized for web display. The remaining items retain representative licensed photos. The UniBasket product brand names are fictional; images illustrate the product type and do not claim to show that exact brand or package. Image provenance and available license details are listed in `PHOTO_CREDITS.md` and linked from the website footer. Sellers can upload a photo when publishing a listing; their listing and its photo are stored only in the current browser.

The navigation uses page routes such as `?page=products`, `?page=categories`, `?page=account` and `?page=basket`, so the site behaves as one connected marketplace while each public area has its own URL state. Seller tools are shown only to accounts registered as sellers.

Browser-saved accounts are tied to the exact site origin, including its port. An account created at `127.0.0.1:4176` is not available at `127.0.0.1:4178`; use the same address and port when returning to an account. Checkout is a test flow and does not process a real payment.

When the API is available, public/script.js loads categories from `/api/categories` and products from `/api/products?limit=100`. If the backend or database is unavailable, the same layout falls back to its local preview data so the HTML, CSS and JavaScript can still be demonstrated.

## Requirements

- Node.js 24 LTS
- MySQL 8.4 LTS
- npm

## Setup

1. Extract the submission folder.
2. Open a terminal in the extracted `unibasket-task3` folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Enter the correct MySQL username and password in `.env`.
6. Ensure the MySQL user can create the `unibasket` database and its tables.
7. Run `npm run db:setup`.
8. Run `npm start`.
9. Open `http://127.0.0.1:4176/`.

## API checks

- `http://127.0.0.1:4176/api/health`
- `http://127.0.0.1:4176/api/categories`
- `http://127.0.0.1:4176/api/products`
- `http://127.0.0.1:4176/api/products?category=essential-groceries`
- `http://127.0.0.1:4176/api/products?search=oats&sort=price_asc`

## Account confirmation email

Registration sends a confirmation email through Gmail or Google Workspace SMTP before the account is saved. Copy `.env.example` to `.env`, enable two-step verification on the sending Google account, create an App Password, and set `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM`, and `APP_URL`. Never commit `.env` or the App Password.

To check the Gmail setup, run `npm run mail:test -- you@example.com`. It logs in to `smtp.gmail.com:465` and sends a test message. On startup, the server also logs whether the Gmail login worked.

## Forgot password

Choose **Forgot password?** on the sign-in screen, enter the email used to register, and enter the emailed six-digit code alongside your new password. Codes expire after 10 minutes, are single use, and allow five attempts. Requesting a new code invalidates the previous code. Email requests are limited to three per address per hour, with at least one minute between requests, and ten per client IP per hour.

Accounts still live in browser storage: use the same browser and site address where you registered. Resetting a password preserves the account name, role, and seller listings. The password is hashed in the browser and is never sent to the reset API. Reset codes are held in server memory, so restarting the server invalidates outstanding codes. Gmail SMTP must be configured to deliver them.

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
    "sender_id": "260XXXXXXXXX",
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

The existing ZMW 1 test returned `response_code: "995"`, `message: "Could'nt complete payment"`, and its matching `reference_no`. This does not confirm success. The supplied Payment Status documentation does not define terminal response codes or a successful response containing the independently verified amount and currency. Until those details are verified, the adapter keeps all status responses unconfirmed (`status: "pending"`, `confirmationAvailable: false`), sends no receipt, and never retries initiation. The frontend displays code 995 with a completion-unconfirmed message. Each subsequent **Check payment status** queries the same saved reference again, and concurrent checks share one provider request. Arbitrary provider messages and credentials are not forwarded to the browser.

There is no active webhook route and no guessed callback payload is trusted. Status queries do not depend on receiving a callback.

The callback fields shown in the ZynlePay settings must eventually use a publicly reachable HTTPS endpoint for this application. A `localhost` value cannot deliver server-to-server callbacks to a developer's computer. Configure that endpoint only after the callback format and authentication are implemented; exposing the entire development app is not required.

The service has a tested confirmation hook for verified terminal responses. Once the provider's response contract is known, the adapter must independently verify the reference, ZMW currency and full amount before confirming the order or emailing a receipt. Concurrent confirmations reuse the same result and send only one receipt. Receipt email failure does not undo a verified payment.

This remains a sandbox demonstration: accounts and seller prices originate in browser storage, and checkout snapshots are kept in server memory for up to 24 hours. Server restarts clear them; check the sandbox dashboard before repeating an interrupted payment. Live payments require server-owned accounts, catalogue pricing and durable order storage. The integration cannot process live payments.

The category endpoint should return five categories. The products endpoint should return 72 products when no filter is supplied.

## Verification commands

- `npm run check`
- `npm test`

Database credentials belong only in `.env`. Do not place them in `public/script.js` or submit a real password in `.env.example`.
