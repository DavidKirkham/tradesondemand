# Trades on Demand

Any trade service in the **Kansas City metro** — emergency or routine. One website / customer app experience for homeowners and property managers. Not a plumbing-only shop, not a UK WordPress port, not a national lead mill.

This repo was an empty README. v1 is a Next.js App Router product: guided booking, contractor signup + public profiles, job status, and a private `/admin` backend for clients and subcontractors.

## Positioning

- **All trades.** Plumbing, Electrical, HVAC, Roofing, Handyman/carpentry, Painting, Flooring, Appliance repair, Locksmith, Pest control, Landscaping, Cleaning, Garage door, Concrete/masonry, Fencing, Windows & doors, Water damage/restoration, plus **General contractor / Other**.
- **KC metro only.** Kansas City (MO and KS), Overland Park, Olathe, Independence, Lee’s Summit, Shawnee, Lenexa, Leawood, Blue Springs, Liberty, and nearby ZIPs. Non-metro cities and ZIPs are rejected with a clear message.
- **Online booking + tap-to-call.** Dispatch number is **(816) 516-0735** (`tel:+18165160735`). Override with `NEXT_PUBLIC_DISPATCH_PHONE` or `NEXT_PUBLIC_PHONE` if needed; the UI works without env setup.
- **Licensed contractors.** Partners apply at `/contractors/signup`. Admin approves/rejects at `/admin/contractors`. Approved shops get a public profile and can be chosen during booking.
- **Marketplace payments.** Customer → **Trades on Demand / Trademark Walls** (Stripe Checkout) → contractor payout later. No Connect transfers in Phase 1. No pay-the-pro-directly flow.
- **v1 surfaces.** Customer booking (including contractor pick), private customer profile, job status, contractor directory/profiles, `/admin` for clients + subcontractors + jobs, `/contractor` PWA for approved partners.

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
- `/admin/clients` / `/admin/clients/[id]` — search, edit contact, edit job-site addresses, booking history, TOD payments  
- `/admin/contractors` / `/admin/contractors/[id]` — all statuses, filter by trade, edit profile/rates, approve/reject, assigned jobs  
- `/admin/jobs` — booking overview; assign an approved subcontractor from the list  
- `/admin/jobs/[id]` — job detail: assign / reassign, status events  
- `/admin/contractors/[id]` — edit shop; **push an unassigned or reassignable job** to that shop  

Set **`ADMIN_PASSWORD` on Vercel** (Project → Settings → Environment Variables) for **Production and Preview**. `/admin` and `/ops` read `process.env.ADMIN_PASSWORD`, then `process.env.OPS_PASSWORD` if the first is unset. There is no default password in the app — do not use a documented example value in production. Locally, put your own value in `.env` (see `.env.example`; that blank is a local-dev placeholder only). Client records stay private; they are not listed on `/contractors`.

### Assign a job to a subcontractor

1. Sign in at `/admin`.
2. Open **Jobs** (`/admin/jobs`) or a job (`/admin/jobs/<id>`).
3. Pick an **approved** shop licensed for that job’s trade → **Assign**. Reassignment shows an in-page confirm.
4. Or open `/admin/contractors/<id>` and use **Push a job to this shop**.
5. The booking gets `contractorId`, status **Dispatched** if it was still Received, and a StatusEvent like `Assigned by admin to Waldo Heat & Pipe`.
6. That shop signs in at `/contractor` (email + phone, or magic link) and sees the ticket under **Assigned**.

Pending / rejected shops never appear in the picker. Cancelled jobs cannot be assigned.

### Contractor PWA (`/contractor`)

Mobile-first app for **approved** licensed partners. Pending and rejected applications cannot sign in.

1. Open [https://todkc.com/contractor](https://todkc.com/contractor) (or `/contractor` on this deploy) on a phone.  
2. iPhone: Share → **Add to Home Screen**. Android: Chrome menu → **Install app** / Add to Home Screen.  
3. Sign in with the **email and phone from the contractor application**. Or open the magic link `/contractor/s/<loginToken>` (issued when the shop is created).

**Seeded test shop (local `npx prisma db seed`):**

- Email: `morgan@waldoheat.example`  
- Phone: `8165160735`  
- Magic link: `/contractor/s/tod-waldo-demo`  

A pending demo (`casey@pending.example` / `8165550199`) is rejected at the door.

Inside the app: assigned jobs, available jobs in your trades/area, job detail, **Accept** (race-safe claim), arrival / ETA text to the client, status (en route / on site / done), and public profile edit. Available cards show neighborhood/ZIP only — full street and customer phone appear after accept (or after admin assign). Customers still pay TOD — the app says not to collect on site.

While `/contractor` is open, the jobs list polls every 20s. If you allow browser notifications, a new matching available job shows an alert. Full Web Push is not in v1.

**Client SMS (optional Twilio):** set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER`. If they are missing, Accept still works; the ETA is saved and `/admin/jobs/<id>` shows SMS skipped. Secrets are never logged.

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
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | For client SMS | Contractor Accept ETA texts. Empty = skip SMS, still save the note. |

## Routes

| Path | Who |
| --- | --- |
| `/` `/services` `/about` `/contact` `/faqs` | Marketing, KC copy |
| `/book` `/book/success` `/book/retry` | Booking + Stripe Checkout return |
| `/contractors` | Approved contractor directory |
| `/contractors/[slug]` | Public profile (approved only; slug, public ID, or id) |
| `/contractors/signup` `/join` | Licensed contractor application |
| `/account` `/account/[token]` | Private customer profile (cookie or magic link after first book) |
| `/status` `/status/[token]` | Customer job status |
| `/contractor` `/contractor/jobs/[id]` `/contractor/profile` | **Approved contractor PWA** — jobs, status, public profile |
| `/admin` `/admin/clients` `/admin/contractors` `/admin/jobs` `/admin/jobs/[id]` | **Owner backend** — review/edit clients and subcontractors; **assign jobs** (`ADMIN_PASSWORD` or `OPS_PASSWORD`) |
| `/ops` | Redirects to `/admin` |
| `/api/bookings` | Create booking + optional Checkout Session |
| `/api/stripe/webhook` | Stripe signature-verified payment updates |
| `/api/contractors` | Public list (approved) + signup POST |
| `/api/status/[token]` | Lookup by job ID or token |
| `/api/contractor/*` | Approved-contractor session (separate cookie from admin/customers) |
| `/api/admin/*` | Authenticated admin login + client/contractor/job edits |
| `/api/ops/*` | Same cookie auth; older ops endpoints still work |

## Out of scope (v1)

SMS and a native Expo app. Contractor jobs run as a PWA at `/contractor`. Any UK WordPress sites.
