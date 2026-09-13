# Trades on Demand

Any trade service in the **Kansas City metro** — emergency or routine. One website / customer app experience for homeowners and property managers. Not a plumbing-only shop, not a UK WordPress port, not a national lead mill.

This repo was an empty README. v1 is a Next.js App Router product: guided booking, contractor signup + public profiles, job status, and a lightweight ops board.

## Positioning

- **All trades.** Plumbing, Electrical, HVAC, Roofing, Handyman/carpentry, Painting, Flooring, Appliance repair, Locksmith, Pest control, Landscaping, Cleaning, Garage door, Concrete/masonry, Fencing, Windows & doors, Water damage/restoration, plus **General contractor / Other**.
- **KC metro only.** Kansas City (MO and KS), Overland Park, Olathe, Independence, Lee’s Summit, Shawnee, Lenexa, Leawood, Blue Springs, Liberty, and nearby ZIPs. Non-metro cities and ZIPs are rejected with a clear message.
- **Online booking + tap-to-call.** Dispatch number is **(816) 516-0735** (`tel:+18165160735`). Override with `NEXT_PUBLIC_DISPATCH_PHONE` or `NEXT_PUBLIC_PHONE` if needed; the UI works without env setup.
- **Licensed contractors.** Partners apply at `/contractors/signup`. Ops approves/rejects. Approved shops get a public profile and can be chosen during booking.
- **Marketplace payments.** Customer → **Trades on Demand** → contractor payout. No pay-the-pro-directly flow, bank fields, or contractor checkout. Stripe is stubbed; `Payment` rows (deposit / balance / adjustment) still exist.
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

`Payment` records belong to TOD (`bookingId`, amount, `DEPOSIT` | `BALANCE` | `ADJUSTMENT`, `PENDING` | `PAID` | `REFUNDED`). Ops can mark paid/refunded. Customer `/account` and job status show receipts, not card numbers. 

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

## Routes

| Path | Who |
| --- | --- |
| `/` `/services` `/about` `/contact` `/faqs` | Marketing, KC copy |
| `/book` | Guided booking wizard |
| `/contractors` | Approved contractor directory |
| `/contractors/[slug]` | Public profile (approved only; slug, public ID, or id) |
| `/contractors/signup` `/join` | Licensed contractor application |
| `/account` `/account/[token]` | Private customer profile (cookie or magic link after first book) |
| `/status` `/status/[token]` | Customer job status |
| `/ops` | Jobs, contractor review, customers, TOD payments |
| `/api/bookings` | Create booking |
| `/api/contractors` | Public list (approved) + signup POST |
| `/api/status/[token]` | Lookup by job ID or token |
| `/api/ops/*` | Authenticated jobs + contractor review |

## Out of scope (v1)

Real Stripe or SMS, a contractor mobile app that accepts jobs, and any UK WordPress sites.
