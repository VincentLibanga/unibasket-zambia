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

The buyer account, basket and checkout panels remain browser-only demonstrations. During registration, a user selects either Buyer account or Seller account. The account page shows that account's profile and lets the user correct the displayed name. A signed-in user's saved profile name appears on a successful order confirmation; a guest enters a name at checkout. Seller listings are saved in the current browser and appear in the catalogue for that browser; a shared database seller catalogue can be added in a later backend milestone.

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

## Demo payments

Checkout sends a demonstration payment to `POST /api/demo-payments`. The buyer chooses MTN MoMo, Airtel Money, Zamtel Kwacha or a test card, plus an outcome: approve, decline or cancel. On approval, the server creates the order and payment references, calculates the total including delivery, and emails a receipt through the same Gmail SMTP setup as the account confirmation email. No real payment is processed and no card or mobile money details are collected.

The category endpoint should return five categories. The products endpoint should return 72 products when no filter is supplied.

## Verification commands

- `npm run check`
- `npm test`

Database credentials belong only in `.env`. Do not place them in `public/script.js` or submit a real password in `.env.example`.
