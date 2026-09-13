# Trades on Demand

Any trade service in the **Kansas City metro** — emergency or routine. One website / customer app experience for homeowners and property managers. Not a plumbing-only shop, not a UK WordPress port, not a national lead mill.

This repo was an empty README. v1 is a Next.js App Router product: guided booking, contractor signup + public profiles, job status, and a lightweight ops board.

## Positioning

- **All trades.** Plumbing, Electrical, HVAC, Roofing, Handyman/carpentry, Painting, Flooring, Appliance repair, Locksmith, Pest control, Landscaping, Cleaning, Garage door, Concrete/masonry, Fencing, Windows & doors, Water damage/restoration, plus **General contractor / Other**.
- **KC metro only.** Kansas City (MO and KS), Overland Park, Olathe, Independence, Lee’s Summit, Shawnee, Lenexa, Leawood, Blue Springs, Liberty, and nearby ZIPs. Non-metro cities and ZIPs are rejected with a clear message.
- **Online booking + tap-to-call.** Dispatch number is **(816) 516-0735** (`tel:+18165160735`). Override with `NEXT_PUBLIC_DISPATCH_PHONE` or `NEXT_PUBLIC_PHONE` if needed; the UI works without env setup.
- **Licensed contractors.** Partners apply at `/contractors/signup`. Ops approves/rejects. Approved shops get a public profile and can be chosen during booking.
- **Marketplace payments.** Customer → **Trades on Demand / Trademark Walls** (Stripe Checkout) → contractor payout later. No Connect transfers in Phase 1. No pay-the-pro-directly flow.
- **v1 surfaces.** Customer booking (including contractor pick), private customer profile, job status, contractor directory/profiles, ops review + TOD ledger. No contractor mobile app. No live Stripe or SMS.

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

**Vercel:** Project → Settings → Environment Variables. Same three names. Production runtime needs the secret; the Next.js build does not.

Local webhook forward (prints a `whsec_` to put in `.env.local`):

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

If secrets are missing the app still runs: bookings are created, deposits stay **pending**, and ops shows a configuration message. 

## Stack

- Next.js App Router, TypeScript, Tailwind CSS v4  
- Prisma + **PostgreSQL** (Neon on Vercel). Production build runs `prisma migrate deploy`.  
- PWA-ready: web manifest, SVG icon, offline fallback, service worker  
- Vitest for metro-gate, booking, contractor, and money validation  

### Database (PostgreSQL)

Production default is PostgreSQL. `prisma/schema.prisma` uses:

- `provider = "postgresql"`
- `url = env("DATABASE_URL")` (Neon pooled / `POSTGRES_PRISMA_URL`)
- `directUrl = env("DATABASE_URL_UNPOOLED")` (Neon unpooled / `POSTGRES_URL_NON_POOLING`)

`npm run build` and `npm run dev` run `scripts/with-db-env.cjs` so those Neon aliases are mapped before Prisma starts. **Do not** set `DATABASE_URL` to `file:./dev.db`.

Vercel production apply:

```bash
prisma migrate deploy
```

That is already part of `npm run build`.

Optional local SQLite only (not used on Vercel): `npx prisma db push --schema prisma/schema.sqlite.prisma` with `SQLITE_DATABASE_URL="file:./dev.db"`.

## How to run

Requires Node 20+.

```bash
cp .env.example .env
npm install
npm run dev
```

`npm run dev` generates the Prisma client, runs `prisma migrate deploy` against PostgreSQL, and starts Next.js (default [http://localhost:3000](http://localhost:3000)). You need a `postgresql://` `DATABASE_URL` (Neon branch or local Postgres).

Optional seed (demo HVAC booking + approved Waldo contractor):

```bash
npx prisma db seed
```

### Scripts

| Command        | What it does                          |
| -------------- | ------------------------------------- |
| `npm run dev`        | Prisma generate + `migrate deploy` + Next dev |
| `npm run build`      | Same migrate step, then production Next build |
| `npm run db:migrate` | `prisma migrate deploy` (Postgres)            |
| `npm start`          | Serve the production build                    |
| `npm test`           | Vitest                                        |
| `npm run lint`       | ESLint                                        |

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL URL (Neon/Vercel pooled). Must start with `postgresql://` or `postgres://`. |
| `DATABASE_URL_UNPOOLED` | No | Direct Postgres URL for migrations. Defaults to `DATABASE_URL` or Neon `POSTGRES_URL_NON_POOLING`. |
| `NEXT_PUBLIC_DISPATCH_PHONE` or `NEXT_PUBLIC_PHONE` | No | Tap-to-call. Hardcoded default is **8165160735** — displays **(816) 516-0735**, links `tel:+18165160735`. Demos work with no env file. |
| `OPS_PASSWORD` | Yes | Password for `/ops` (default in `.env.example`: `dispatch`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | Trademark Walls sandbox. Default `pk_test_51UF1qLJOVLPQ6426…` (safe client-side). |
| `STRIPE_SECRET_KEY` | For Checkout | Server-only. Empty = graceful degrade |
| `STRIPE_WEBHOOK_SECRET` | For webhooks | From `stripe listen` or Dashboard endpoint |

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
| `/ops` | Jobs, contractor review, customers, TOD payments |
| `/api/bookings` | Create booking + optional Checkout Session |
| `/api/stripe/webhook` | Stripe signature-verified payment updates |
| `/api/contractors` | Public list (approved) + signup POST |
| `/api/status/[token]` | Lookup by job ID or token |
| `/api/ops/*` | Authenticated jobs + contractor review |

## Out of scope (v1)

Real Stripe or SMS, a contractor mobile app that accepts jobs, and any UK WordPress sites.
