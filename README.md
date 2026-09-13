# Trades on Demand

Any trade service in the **Kansas City metro** — emergency or routine. One website / customer app experience for homeowners and property managers. Not a plumbing-only shop, not a UK WordPress port, not a national lead mill.

This repo was an empty README. v1 is a Next.js App Router product: guided booking, contractor signup + public profiles, job status, and a private `/admin` backend for clients and subcontractors.

## Positioning

- **All trades.** Plumbing, Electrical, HVAC, Roofing, Handyman/carpentry, Painting, Flooring, Appliance repair, Locksmith, Pest control, Landscaping, Cleaning, Garage door, Concrete/masonry, Fencing, Windows & doors, Water damage/restoration, plus **General contractor / Other**.
- **KC metro only.** Kansas City (MO and KS), Overland Park, Olathe, Independence, Lee’s Summit, Shawnee, Lenexa, Leawood, Blue Springs, Liberty, and nearby ZIPs. Non-metro cities and ZIPs are rejected with a clear message.
- **Online booking + tap-to-call.** Dispatch number is **(816) 516-0735** (`tel:+18165160735`). Override with `NEXT_PUBLIC_DISPATCH_PHONE` or `NEXT_PUBLIC_PHONE` if needed; the UI works without env setup.
- **Licensed contractors.** Partners apply at `/contractors/signup`. Admin approves/rejects at `/admin/contractors`. Approved shops get a public profile and can be chosen during booking.
- **Marketplace payments.** Customer → **Trades on Demand / Trademark Walls** (Stripe Checkout) → contractor payout later. No Connect transfers in Phase 1. No pay-the-pro-directly flow.
- **v1 surfaces.** Customer booking (including contractor pick), password-protected `/account` portal (jobs + TOD pay), job status, contractor directory/profiles, `/admin` for clients + subcontractors + jobs, `/contractor` PWA for approved partners.

## Core booking loop

1. Trade + problem  
2. Address / ZIP (KC metro gate)  
3. Emergency vs routine  
4. Licensed contractor (or first available)  
5. Quote / TOD deposit (selected contractor rates or first-available hold; stub charge)  
6. Confirm (name, phone, email) — pay Trades on Demand  
7. Job status + private receipts → done  

## Marketplace payments

Customers pay **Trades on Demand** for deposits, trip minimums, and later job balances. Contractors are paid by TOD (payouts). There is no “pay contractor directly” CTA, and contractor signup does not collect bank details in v1.

`Payment` records belong to TOD (`bookingId`, amount, `DEPOSIT` | `BALANCE` | `ADJUSTMENT`, `PENDING` | `PAID` | `REFUNDED`, Stripe session/intent ids). The Stripe webhook is the source of truth for paid. Ops can still mark paid/refunded. Customer `/account` and job status show receipts + session id, not card numbers.

## Stripe Checkout (Phase 1)

Platform merchant of record: **Trademark Walls** sandbox (test mode). Do **not** use Stripe Connect `destination` / `transfer_data`. Checkout and `/api/stripe/webhook` read **only** `process.env` — there is no hardcoded secret key.

### Publishable key (safe to commit)

Default in `.env.example` and the app if unset:

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51UF1qLJOVLPQ6426SHn9n0iOGiePlgrUv0gZEW5Xf41nypWfrtYrae3McmrJxIIf7bu9pw4MCkJzAdH208EqacP600nPrKp2A0`

### Secrets (never commit)

Leave `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` empty in `.env.example`. Do not invent values.

**Cursor Cloud Agent:** add them under the environment / Cloud Agent **Secrets** so the run injects them as env vars. The secret key is already stored there for this project; do not paste it into the repo.

**Local machine:** create `.env.local` (gitignored; Next.js loads it automatically):

```bash
# .env.local — not committed
STRIPE_SECRET_KEY=sk_test_...          # Stripe Dashboard → Developers → API keys
STRIPE_WEBHOOK_SECRET=whsec_...        # from `stripe listen` or Dashboard → Webhooks
# optional override; otherwise the Trademark Walls pk_test_ default is used
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Vercel:** Project → Settings → Environment Variables. Same three names (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`). Production runtime needs the secret; the Next.js build does not.

Local webhook forward (prints a `whsec_` to put in `.env.local`):

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

If secrets are missing the app still runs: bookings are created, deposits stay **pending**, and ops shows a configuration message. 

## Stack

- Next.js App Router, TypeScript, Tailwind CSS v4  
- Prisma + **PostgreSQL** (Neon / Vercel Postgres / Supabase). `prisma generate` runs at install/build **without** a live DB. Migrations are a separate step.  
- PWA-ready: web manifest, SVG icon, offline fallback, service worker  
- Vitest for metro-gate, booking, contractor, and money validation  

### Database (PostgreSQL)

Production is PostgreSQL. `prisma/schema.prisma` uses `provider = "postgresql"` and `url = env("DATABASE_URL")`.

Set a Postgres-compatible URL on Vercel (Production + Preview):

| Source | Typical variable |
| --- | --- |
| Neon / Vercel Postgres | `DATABASE_URL` or `POSTGRES_PRISMA_URL` / `POSTGRES_URL` |
| Supabase | `DATABASE_URL` (URI from Project Settings → Database) |

`scripts/with-db-env.cjs` maps Neon aliases (`POSTGRES_PRISMA_URL`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `DATABASE_URL_UNPOOLED`) onto `DATABASE_URL` before Prisma CLI runs. **Do not** set `DATABASE_URL` to `file:./dev.db` on Vercel.

`npm run build` / `postinstall` only run `prisma generate` (placeholder URL if unset). They do **not** connect or migrate. Production **runtime** still requires `DATABASE_URL` — request handlers throw if it is missing.

Do not use SQLite on Vercel. `prisma/schema.prisma` provider is **postgresql** only.

### Production migrate (Neon) — required for contractor signup

`POST /api/contractors` writes `Contractor.loginToken`. If Neon is behind the Prisma schema (empty DB, or missing that column), Prisma throws and signup used to return an empty HTTP 500. Apply migrations to production. **`next build` never does this.**

Prisma expects these folders, in order:

| Migration | What it creates |
| --- | --- |
| `prisma/migrations/20260913120000_init` | `Booking`, `StatusEvent`, `Contractor`, `Customer`, `Payment` (Contractor **without** `loginToken`) |
| `prisma/migrations/20260913140000_stripe_checkout_ids` | `Payment.stripeCheckoutSessionId`, `Payment.stripePaymentIntentId` |
| `prisma/migrations/20260913160000_contractor_login_token` | `Contractor.loginToken` `TEXT NOT NULL UNIQUE` (backfill, then unique index) |
| `prisma/migrations/20260913180000_customer_sms` | Optional booking SMS columns |
| `prisma/migrations/20260913200000_contractor_password` | `Contractor.passwordHash`, `Contractor.sessionToken` (nullable unique) |
| `prisma/migrations/20260913220000_contractor_password_reset` | `ContractorPasswordReset` (SMS forgot-password token + code hashes) |
| `prisma/migrations/20260913230000_customer_password` | `Customer.passwordHash`, `Customer.sessionToken`, SMS reset code columns |
| `prisma/migrations/20260913240000_contractor_push_subscription` | `ContractorPushSubscription` (Web Push endpoints per approved shop) |

Exact production command (`prisma migrate deploy` via the env wrapper):

```bash
# From the repo root, on a machine that can reach Neon.
# Prefer the Vercel Production values (Project → Settings → Environment Variables),
# or: npx vercel env pull .env.production --yes --environment=production
# then: set -a && source .env.production && set +a

export DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
# Prisma migrate uses the direct/unpooled URL when present:
export DATABASE_URL_UNPOOLED="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"

# Neon / Vercel Postgres aliases also work — scripts/with-db-env.cjs maps them:
#   POSTGRES_PRISMA_URL / POSTGRES_URL          → DATABASE_URL
#   POSTGRES_URL_NON_POOLING / DIRECT_URL       → DATABASE_URL_UNPOOLED

npm run db:migrate
```

That is the only supported apply path. Do not use `prisma migrate dev` on production.

If you cannot run Node against Neon, paste the SQL from those three `migration.sql` files **in order** in the Neon SQL Editor. If tables already exist and only signup is 500, the third file is usually enough:

```sql
ALTER TABLE "Contractor" ADD COLUMN "loginToken" TEXT;

UPDATE "Contractor"
SET "loginToken" = 'pro_' || substr(md5(random()::text || "id"), 1, 28)
WHERE "loginToken" IS NULL;

ALTER TABLE "Contractor" ALTER COLUMN "loginToken" SET NOT NULL;

CREATE UNIQUE INDEX "Contractor_loginToken_key" ON "Contractor"("loginToken");
```

Hand-applying SQL without `migrate deploy` will not record rows in `_prisma_migrations`. Prefer `npm run db:migrate` so later deploys stay in sync.

## How to run

Requires Node 20+.

```bash
cp .env.example .env
npm install
npm run dev
```

`npm run dev` generates the Prisma client (no live DB required) and starts Next.js (default [http://localhost:3000](http://localhost:3000)). For booking/admin data you need a `postgresql://` `DATABASE_URL` (Neon branch or local Postgres), then `npm run db:migrate`.

### Admin backend (`/admin`)

Password-protected owner UI (same cookie as the old `/ops` board; `/ops` redirects here).

- `/admin` — counts + recent clients + pending subcontractors  
- `/admin/clients` / `/admin/clients/[id]` — search, edit contact, edit job-site addresses, booking history, TOD payments, **delete**  
- `/admin/contractors` / `/admin/contractors/[id]` — all statuses, filter by trade, edit profile/rates, approve/reject, **delete**, assigned jobs  
- `/admin/jobs` — booking overview; assign an approved subcontractor from the list; **delete** jumps to typed confirm  
- `/admin/jobs/[id]` — job detail: assign / reassign, status events, **delete**  
- `/admin/contractors/[id]` — edit shop; **push an unassigned or reassignable job** to that shop  

Set **`ADMIN_PASSWORD` on Vercel** (Project → Settings → Environment Variables) for **Production and Preview**. `/admin` and `/ops` read `process.env.ADMIN_PASSWORD`, then `process.env.OPS_PASSWORD` if the first is unset. There is no default password in the app — do not use a documented example value in production. Locally, put your own value in `.env` (see `.env.example`; that blank is a local-dev placeholder only). Client records stay private; they are not listed on `/contractors`.

### Assign a job to a subcontractor

1. Sign in at `/admin`.
2. Open **Jobs** (`/admin/jobs`) or a job (`/admin/jobs/<id>`).
3. Pick an **approved** shop licensed for that job’s trade → **Assign**. Reassignment shows an in-page confirm.
4. Or open `/admin/contractors/<id>` and use **Push a job to this shop**.
5. The booking gets `contractorId`, status **Dispatched** if it was still Received, and a StatusEvent like `Assigned by admin to Waldo Heat & Pipe`.
6. That shop is notified: Web Push if they enabled job push on the PWA, otherwise an SMS to the shop phone when Twilio is configured. Opening the notification lands on `/contractor/jobs/<booking id>`.
7. That shop signs in at `/contractor` (email / phone / shop ID **and password**) and sees the ticket under **Assigned**.

Pending / rejected shops never appear in the picker. Cancelled jobs cannot be assigned.

### Delete a subcontractor

1. Sign in at `/admin` and open **Subcontractors** (`/admin/contractors`) or a shop (`/admin/contractors/<id>`).
2. On the list, **Delete** jumps to the typed-confirm panel on that shop. On the detail page, **Delete subcontractor** is at the bottom of the profile actions.
3. Type the **exact business name** (case-insensitive) and confirm. `DELETE /api/admin/contractors/<id>` requires the same admin cookie as the rest of `/admin`.
4. After delete, you land back on the subcontractors list with a success banner.

**Booking rule:** open jobs (`RECEIVED`, `DISPATCHED`, `EN_ROUTE`, `ON_SITE`) **block** delete so active or unpaid work is not silently unassigned. Reassign, complete, or cancel those jobs first. Completed and cancelled jobs stay on the books with `contractorId` set to `null`. Payments stay on the booking. `ContractorPasswordReset` and `ContractorPushSubscription` rows cascade. The shop’s `loginToken` / `sessionToken` / password hash go away with the contractor row. There is no Invoice model in v1.

### Delete a job

1. Sign in at `/admin` and open **Jobs** (`/admin/jobs`) or a ticket (`/admin/jobs/<id>`).
2. On the list or job card, **Delete** jumps to the typed-confirm panel. On the detail page, **Delete job** is at the bottom.
3. Type the **public job ID** (case-insensitive, e.g. `TOD-ABC123`) and confirm. `DELETE /api/admin/bookings/<id>` requires the same admin cookie as the rest of `/admin`. Unauthenticated callers get **401**.
4. After delete, you land back on the jobs list with a success banner.

**Payment / SMS rule:** `PAID` invoices **block** delete so Stripe ledger rows are not silently cascaded. Open Stripe Checkout sessions (`PENDING` + `stripeCheckoutSessionId`) also **block**, because a customer could still complete payment after the job vanished. Refund paid items or let the session expire first. Allowed jobs cascade `StatusEvent` rows and remaining `Payment` rows (`PENDING` without a session, or `REFUNDED`). Client SMS fields live on the booking and go away with it. Job status itself does not block — spam or cancelled tickets can be removed.

### Delete a client

1. Sign in at `/admin` and open **Clients** (`/admin/clients`) or a profile (`/admin/clients/<id>`).
2. On the list, **Delete** jumps to the typed-confirm panel. On the detail page, **Delete client** is at the bottom.
3. Type the **exact client name** (case-insensitive) and confirm. `DELETE /api/admin/clients/<id>` requires the same admin cookie. Unauthenticated callers get **401**.
4. After delete, you land back on the clients list with a success banner.

**Booking rule:** same safety as contractor delete. Open jobs **block** delete so active work is not silently unlinked. Complete or cancel those jobs first. Completed and cancelled jobs stay on the books with `customerId` set to `null`; denormalized name, phone, and email remain on those tickets. Payment rows stay on the jobs with `customerId` set to `null`. Portal login (`passwordHash` / `sessionToken` / reset-code fields) goes away with the customer row.

### Customer portal (`/account`)

Password-protected jobs and payments for homeowners and property managers. Cookie is `tod_customer_session` (rotating `Customer.sessionToken`). It is **not** the contractor cookie (`tod_contractor`) or the admin cookie.

1. Open [https://todkc.com/account](https://todkc.com/account) — logged-out visits redirect to `/account/login`.
2. **New customer:** Create an account (name, email, phone, 10+ character password) or book first — booking signs you into the portal and you can set a password on Profile.
3. **Existing customer (booked before passwords):** **Claim my jobs** with the booking email + phone, then choose a password. Or open `/account/<customer.token>` / `/account/s/<token>` (set-password only). After a password exists, that link cannot sign anyone in.
4. **Forgot password:** `/account/forgot` texts a 6-digit code via Twilio to the phone on the Customer record. Email reset is not wired. 555 test numbers cannot receive SMS — call dispatch or use the seed password below.
5. **Jobs:** current vs past (completed/cancelled), status, dates, trade, booking IDs, owed vs paid.
6. **Pay:** pending deposit/balance opens the same TOD Stripe Checkout as booking. Success returns to the job. Webhook is still the source of truth for paid.

**Seeded test customer (local `npx prisma db seed`):**

| | Email | Phone | Password | Notes |
| --- | --- | --- | --- | --- |
| Signed-in demo | `riley@example.com` | `8165550144` | `riley-demo-10` | Jobs `TOD-DEMO01` (pending deposit), `TOD-OPEN01`, `TOD-DONE01`, `TOD-CXL01` |
| Claim path | `jordan@example.com` | `8165550133` | *(none until claimed)* | Job `TOD-CLAIM01` + pending `PAY-CLAIM01`. Invite: `/account/s/demo-claim-customer-kc` |

Production **must** apply `20260913230000_customer_password` (`npm run db:migrate`) or login/register will fail against a missing column.

### Contractor PWA (`/contractor`)

Mobile-first app for **approved** licensed partners. Pending and rejected applications cannot sign in.

1. Open [https://todkc.com/contractor](https://todkc.com/contractor) (or `/contractor` on this deploy) on a phone.  
2. iPhone: Share → **Add to Home Screen**. Android: Chrome menu → **Install app** / Add to Home Screen.  
3. Sign in with **email, phone, or shop ID (`PRO-…`) plus a password**. Magic link `/contractor/s/<loginToken>` is only a one-time set-password invite (or a reminder to use the password). It does not stay a passwordless login.

**Existing approved shops (no password yet)**

1. First visit: on `/contractor` tap **Set a password**, enter the application email + phone, choose a 10+ character password.  
2. Or open the invite `/contractor/s/<loginToken>` (shown on Admin → Subcontractor while no password is set) and choose a password.  
3. After that, every visit is identifier + password. Session cookie is a rotating `sessionToken`, not the invite token.  
4. **Forgot password:** on `/contractor` tap **Forgot password?** (or open `/contractor/forgot`). Enter email, phone, or shop ID. If the shop is approved and already has a password, Twilio texts the **application phone** a 6-digit code plus a one-time link (`/contractor/r/<token>`). Enter the code (or open the link), choose a new 10+ character password. That issues a new `sessionToken` and invalidates the old password, old session, and the reset. Pending/rejected shops get the same generic message and no text. Dispatch backup is still **Admin → Subcontractor → Issue set-password link** or **Set password**.  
5. Shops change their own password on **Profile**.

**Seeded test shop (local `npx prisma db seed`):**

- Email: `morgan@waldoheat.example`  
- Phone: `8165160735`  
- Shop ID: `PRO-DEMO01`  
- Password: `waldo-demo-10`  
- Invite (set-password only if the hash is cleared): `/contractor/s/tod-waldo-demo`  

A pending demo (`casey@pending.example` / `8165550199`) is rejected at the door.

**How to test the contractor PWA**

1. Seed: `npm run db:seed` (needs Postgres).  
2. Open `/contractor` (logged-out `/contractor/jobs/…` redirects here).  
3. Sign in with the Waldo email (or `PRO-DEMO01`) and `waldo-demo-10`.  
4. **Jobs** — current assigned (`TOD-DEMO01`) + available (`TOD-OPEN01`). Accept + En route / On site / Done + ETA text.  
5. **Past** — completed `TOD-DONE01` and cancelled `TOD-CXL01`.  
6. **SMS** — text only on jobs you own; 555 numbers skip; missing Twilio still saves the note.  
7. **Pay** — per-job pending/paid/refunded from `Payment` rows + history. Copy states payouts are via TOD.  
8. **Profile** — edit contact, coverage, rates, bio → Save. Change password with the current password.  
9. **Job push** — on Profile tap **Enable job push** (or the header link). Assign `TOD-OPEN01` to Waldo from `/admin` (or book that shop). A push should fire if VAPID keys are set; otherwise Twilio texts the shop phone when configured. Tap the notification → `/contractor/jobs/<id>`.

Inside the app: **Jobs** (open assigned + available), **Past** (completed/cancelled), **SMS** (text customers on jobs you own), job detail (**Accept**, En route / On site / Done, arrival text), **Profile** (business contact, coverage, rates, bio), and **Pay** (per-job TOD payment status + Payment history). Available cards show neighborhood/ZIP + a problem summary — full street and customer phone appear after accept (or after admin assign). Customers still pay TOD — the app says not to collect on site. Payouts are via TOD; the Pay page does not invent Stripe Connect.

**Matching:** an unassigned, not-complete/cancelled booking is available when the shop is **APPROVED**, their `tradesJson` includes the job trade, and `serviceArea` covers the job city or ZIP (case-insensitive substring). Writing **metro** (e.g. “Kansas City metro”) also matches any KC metro city/ZIP from `src/lib/kc-metro.ts`. A city-only list (e.g. “Olathe and 66061”) does not see Independence.

**Booked-job push:** when admin assigns a shop or a customer books a specific approved contractor, the server sends a Web Push to that shop’s stored subscriptions (`ContractorPushSubscription`). The service worker opens `/contractor/jobs/<booking id>`. If the shop has no subscription (or all endpoints are gone), Twilio texts the application phone — same credentials as customer ETA SMS. Contractor self-accept from the available list does not re-notify (they just tapped Accept). Enable push from the contractor header (**Enable job push**) or **Profile**. iPhone needs the PWA on the Home Screen. Requires VAPID keys (see Environment variables). The available-jobs poll every 20s is unchanged.

**Client SMS (optional Twilio):** set `TWILIO_ACCOUNT_SID` (Account SID `AC…`, used only in the Messages URL), `TWILIO_FROM_NUMBER`, and either `TWILIO_API_KEY_SID` (`SK…`) + `TWILIO_API_KEY_SECRET` **or** `TWILIO_AUTH_TOKEN`. If they are missing, Accept still works; the ETA is saved and `/admin/jobs/<id>` shows SMS skipped. The same credentials send contractor **forgot-password** texts to the shop phone. Secrets are never logged. Do not put an API Key SID in `TWILIO_ACCOUNT_SID` — that breaks the `/Accounts/{sid}/Messages.json` path.

Optional seed (demo HVAC booking + approved Waldo contractor):

```bash
npx prisma db seed
```

### Scripts

| Command        | What it does                          |
| -------------- | ------------------------------------- |
| `npm run dev`        | Prisma generate + Next dev (no migrate) |
| `npm run build`      | Prisma generate + `next build` (no live DB) |
| `npm run db:migrate` | `prisma migrate deploy` (needs a real Postgres URL) |
| `npm start`          | Serve the production build                    |
| `npm test`           | Vitest                                        |
| `npm run lint`       | ESLint                                        |
| `npm run vapid:keys` | Print VAPID public/private keys for contractor Web Push |

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Runtime (Vercel) | PostgreSQL URL (Neon / Vercel Postgres / Supabase). `postgresql://` or `postgres://`. Not required for `next build`. |
| `POSTGRES_PRISMA_URL` / `POSTGRES_URL` | Alias | Neon/Vercel inject these; the app maps them to `DATABASE_URL`. |
| `DATABASE_URL_UNPOOLED` | No | Optional Neon direct URL; used if `DATABASE_URL` is unset. |
| `NEXT_PUBLIC_DISPATCH_PHONE` or `NEXT_PUBLIC_PHONE` | No | Tap-to-call. Hardcoded default is **8165160735** — displays **(816) 516-0735**, links `tel:+18165160735`. Demos work with no env file. |
| `ADMIN_PASSWORD` | Runtime (Vercel) | Password for `/admin`. Set on Vercel for Production + Preview. No code default. |
| `OPS_PASSWORD` | Compat | Used only if `ADMIN_PASSWORD` is unset. `/ops` redirects to `/admin`. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | Trademark Walls sandbox. Default `pk_test_51UF1qLJOVLPQ6426…` (safe client-side). |
| `STRIPE_SECRET_KEY` | For Checkout | Server-only. Empty = graceful degrade |
| `STRIPE_WEBHOOK_SECRET` | For webhooks | From `stripe listen` or Dashboard endpoint |
| `TWILIO_ACCOUNT_SID` | For SMS | Twilio Account SID (`AC…`). Used only in the Messages API path. Required whenever SMS is enabled. |
| `TWILIO_API_KEY_SID` / `TWILIO_API_KEY_SECRET` | For SMS (preferred) | API Key SID (`SK…`) + secret for Basic auth. When both are set they are used instead of the Auth Token. |
| `TWILIO_AUTH_TOKEN` | For SMS (fallback) | Account Auth Token. Used for Basic auth when API key SID+secret are not both set. |
| `TWILIO_FROM_NUMBER` | For SMS | Twilio sender number. Empty Twilio creds = skip send (accept still works; self-serve reset will not deliver a text — use Admin backup). |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | For contractor Web Push | Generate with `npm run vapid:keys`. Empty = subscribe stays off; assign/booking still works. SMS fallback uses Twilio + shop phone when no push subscription is stored. |
| `VAPID_SUBJECT` | No | `mailto:` or `https:` contact in the VAPID JWT. Default `https://www.tradesondemand.com`. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | Optional alias for the public key. The authenticated `GET /api/contractor/push` also returns `VAPID_PUBLIC_KEY`. |

## Routes

| Path | Who |
| --- | --- |
| `/` `/services` `/about` `/contact` `/faqs` | Marketing, KC copy |
| `/book` `/book/success` `/book/retry` | Booking + Stripe Checkout return |
| `/contractors` | Approved contractor directory |
| `/contractors/[slug]` | Public profile (approved only; slug, public ID, or id) |
| `/contractors/signup` `/join` | Licensed contractor application |
| `/account` `/account/login` `/account/forgot` `/account/jobs/[id]` `/account/profile` | **Customer portal** — password login, jobs past/present, TOD Checkout |
| `/account/[token]` `/account/s/[token]` | One-time set-password invite (not a passwordless session) |
| `/status` `/status/[token]` | Customer job status |
| `/contractor` `/contractor/forgot` `/contractor/r/[token]` `/contractor/jobs/[id]` `/contractor/past` `/contractor/messages` `/contractor/payments` `/contractor/profile` | **Approved contractor PWA** — sign-in, forgot-password SMS reset, current jobs, past jobs, SMS, TOD payment status, profile |
| `/admin` `/admin/clients` `/admin/contractors` `/admin/jobs` `/admin/jobs/[id]` | **Owner backend** — review/edit/delete clients, subcontractors, and jobs (`ADMIN_PASSWORD` or `OPS_PASSWORD`) |
| `/ops` | Redirects to `/admin` |
| `/api/bookings` | Create booking + optional Checkout Session |
| `/api/stripe/webhook` | Stripe signature-verified payment updates |
| `/api/contractors` | Public list (approved) + signup POST |
| `/api/status/[token]` | Lookup by job ID or token |
| `/api/account/*` | Customer portal session (`tod_customer_session`, distinct from contractor/admin) |
| `/api/contractor/*` | Approved-contractor session (separate cookie from admin/customers) |
| `/api/contractor/push` | Get VAPID public key + save/delete this shop’s Web Push subscription |
| `/api/admin/*` | Authenticated admin login + client/contractor/job edits + admin delete (contractor, job, client) |
| `/api/ops/*` | Same cookie auth; older ops endpoints still work |

## Out of scope (v1)

SMS and a native Expo app. Contractor jobs run as a PWA at `/contractor`. Any UK WordPress sites.
