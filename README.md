# ShopYaro

An online shop with a customer storefront and an admin panel.

- **Storefront:** browse products and deals, cart, checkout with Stripe, order history, reviews with photos and videos.
- **Admin panel (`/admin`):** products, categories, orders (ship and track), reviews (approve or reject), coupons, banners, analytics and an Activity log of every admin change.
- **Money** is stored as whole cents (integers) and shown in USD. Search the code for `TODO(market)` to find the places to change when the shop moves to another currency.

## How it is built

| Part | Technology |
| --- | --- |
| Website (`client/`) | React 19, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form + Zod |
| Database, login, rules | Supabase: Postgres with Row Level Security (RLS), Auth, Edge Functions |
| Pictures and videos | Cloudinary (signed uploads only) |
| Payments | Stripe Checkout (test mode until you switch the keys) |
| Hosting | Vercel (website), Supabase (backend) |

The website only ever holds two public values (the Supabase URL and the publishable key). Every secret lives in Supabase Edge Function secrets. **Nothing secret belongs in the website, in Vercel or in GitHub.**

```
client/                 the website
  src/features/         one folder per area: admin, auth, cart, catalog, checkout, orders, profile, reviews ...
  src/shared/           small things used everywhere
supabase/
  migrations/           the database, as numbered SQL files (0000 to 0014)
  functions/            Edge Functions: create-checkout-session, stripe-webhook, sign-upload, delete-assets
  verification/         scripts that prove the database rules work (see "Checking the database")
.github/workflows/      CI: lint, tests and build on every push
```

## Run it on your computer

You need Node.js 22 or newer.

```bash
cd client
npm install
cp .env.example .env.local   # then fill in the two values (see below)
npm run dev                  # http://localhost:5173
```

`client/.env.local` needs exactly:

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<the publishable (anon) key from Supabase -> Project Settings -> API>
```

Never put a `service_role` key, a Stripe secret or a Cloudinary secret here.

### Commands (run inside `client/`)

| Command | What it does |
| --- | --- |
| `npm run dev` | development server |
| `npm run lint` | code style and mistakes check |
| `npm test` | all tests (uses the `vmForks` pool, set in `vite.config.js`, because the default pool fails to start on some Windows machines) |
| `npm run build` | production build into `client/dist` |

The same lint, test and build run automatically on GitHub for every push (`.github/workflows/ci.yml`).

## Set up the backend (Supabase)

There is no Supabase command-line tool in this project. Everything is pasted into the Supabase Dashboard.

### 1. Database

Open **SQL Editor** and run the files in `supabase/migrations/` **in number order, each one once**: `0000_baseline.sql` first, then `0001` ... `0014`. Read the comment at the top of a file before running it. `0000` explains what it rebuilds and what lives only in the live database.

Every database change goes into a new numbered file here first, is reviewed, then is run. Never change the live database by hand without a matching file.

### 2. First admin

Sign up on the website, then in the SQL Editor:

```sql
update public.user_roles set role = 'admin' where user_id = '<the user id from Authentication -> Users>';
```

### 3. Edge Functions

In **Edge Functions**, create one function per folder in `supabase/functions/` (same name), paste the code of its `index.ts`, and deploy. Keep **Verify JWT** on for `sign-upload`, `delete-assets` and `create-checkout-session`. `stripe-webhook` is called by Stripe, so it checks Stripe's signature instead.

In **Edge Functions -> Secrets** set:

| Secret | Used by |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | `sign-upload`, `delete-assets` |
| `STRIPE_SECRET_KEY` | `create-checkout-session`, `stripe-webhook` |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase itself.

In Stripe, point a webhook at `https://<your-project>.supabase.co/functions/v1/stripe-webhook` and send it these events: `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded` and `checkout.session.async_payment_failed`.

The Edge Functions only answer requests from the origins listed at the top of each file (`ALLOWED_ORIGINS`). Add your own domain there when you get one.

### 4. Login

In **Authentication -> URL Configuration**, set the Site URL and add your website addresses (production and `http://localhost:5173`) to the redirect URLs. Google login is switched on under **Authentication -> Providers**.

## Cloudinary

Uploads go from the browser straight to Cloudinary using a signature made by an Edge Function. Review photos and videos are stored under `shopyaro/reviews/<review id>/...`.

Cloudinary cannot limit file size or video length inside a signed upload, so the website checks them first and the database checks the reported size again. **On the paid plan, also set the account's maximum image and video file size** (Settings -> Upload) as the final hard stop. After going live, upload a photo with GPS data and confirm the location is gone from the delivered file.

Files that are no longer used (deleted products, reviews, replaced pictures) are queued in the database and removed from Cloudinary by `delete-assets`.

## Checking the database

`supabase/verification/` holds scripts for the SQL Editor. Each pair is a "structure" script (read-only, shows what exists) and a "behaviour" script (tries real actions as a visitor, a customer and an admin, then **rolls everything back on purpose**; the red error that starts with `... TEST RESULTS` is the report). Run them after the matching migration. For example, after `0013`: `reviews_check_a_structure.sql` then `reviews_check_b_behaviour.sql`.

## Deploy the website (Vercel)

Import the repository in Vercel with **Root Directory = `client`**. Set the same two `VITE_` variables. `client/vercel.json` already sends every route to the single page and sets the security headers.

The Content-Security-Policy is **enforced** (it was tested in Report-Only mode first, with no violations across login, checkout, uploads and admin). If you add a new outside service (analytics, a new image host, a payment provider), add its address to the policy in `client/vercel.json`, or the browser will block it. To test a change safely, temporarily rename the header to `Content-Security-Policy-Report-Only`, which only logs problems in the console.

## Before going live

- Switch Stripe to live keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) and create the live webhook.
- Move Cloudinary to the paid plan and set the file-size limits above.
- Rotate any secret that was ever shown in a chat, screenshot or commit.
- Update `ALLOWED_ORIGINS` in the Edge Functions and the redirect URLs in Supabase to the real domain.
- Replace the draft Privacy page (`client/src/features/legal/`) with a real policy, and add the other legal pages (terms, returns) the shop needs.
