# Trades on Demand

Any trade service in the **Kansas City metro** — emergency or routine. One website / customer app experience for homeowners and property managers. Not a plumbing-only shop, not a UK WordPress port, not a national lead mill.

This repo was an empty README. v1 is a Next.js App Router product: guided booking, contractor signup + public profiles, job status, and a lightweight ops board.

## Positioning

- **All trades.** Plumbing, Electrical, HVAC, Roofing, Handyman/carpentry, Painting, Flooring, Appliance repair, Locksmith, Pest control, Landscaping, Cleaning, Garage door, Concrete/masonry, Fencing, Windows & doors, Water damage/restoration, plus **General contractor / Other**.
- **KC metro only.** Kansas City (MO and KS), Overland Park, Olathe, Independence, Lee’s Summit, Shawnee, Lenexa, Leawood, Blue Springs, Liberty, and nearby ZIPs. Non-metro cities and ZIPs are rejected with a clear message.
- **Online booking + tap-to-call.** Dispatch number is **(816) 516-0735** (`tel:+18165160735`). Override with `NEXT_PUBLIC_DISPATCH_PHONE` or `NEXT_PUBLIC_PHONE` if needed; the UI works without env setup.
- **Licensed contractors.** Partners apply at `/contractors/signup`. Ops approves/rejects. Approved shops get a public profile and can be chosen during booking.
- **Marketplace payments.** Customers pay **Trades on Demand**. TOD pays contractors. No pay-the-pro-directly flow. Stripe is stubbed; payment rows still exist.
- **v1 surfaces.** Customer booking (including contractor pick), private customer profile, job status, contractor directory/profiles, ops review + TOD ledger. No contractor mobile app. No live Stripe or SMS.

## Core booking loop

1. Trade + problem  
2. Address / ZIP (KC metro gate)  
3. Emergency vs routine  
4. Licensed contractor (or first available)  
5. Quote / deposit clarity (policy stub — no card charge)  
6. Confirm (name, phone, email)  
7. Job status → done  

## Stack

- Next.js App Router, TypeScript, Tailwind CSS v4  
- Prisma + SQLite for demo persistence (`prisma/dev.db`)  
- PWA-ready: web manifest, SVG icon, offline fallback, service worker  
- Vitest for metro-gate, booking, contractor, and money validation  

### Swapping SQLite for Postgres later

1. Change `provider` in `prisma/schema.prisma` to `postgresql`.  
2. Set `DATABASE_URL` to a Postgres URL (see `.env.example`).  
3. Run `npx prisma migrate dev` instead of `db push`.  
4. No application code should need to change beyond the Prisma datasource.

## How to run

Requires Node 20+.

```bash
cp .env.example .env
npm install
npm run dev
```

`npm run dev` generates the Prisma client, pushes the SQLite schema, and starts Next.js (default [http://localhost:3000](http://localhost:3000)).

Optional seed (demo HVAC booking + approved Waldo contractor):

```bash
npx prisma db seed
```

### Scripts

| Command        | What it does                          |
| -------------- | ------------------------------------- |
| `npm run dev`  | Prisma generate + db push + Next dev  |
| `npm run build`| Production build (also generates DB)  |
| `npm start`    | Serve the production build            |
| `npm test`     | Vitest                                |
| `npm run lint` | ESLint                                |

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | SQLite file URL, e.g. `file:./dev.db` (relative to `/prisma`) |
| `NEXT_PUBLIC_DISPATCH_PHONE` or `NEXT_PUBLIC_PHONE` | No | Tap-to-call. Hardcoded default is **8165160735** — displays **(816) 516-0735**, links `tel:+18165160735`. Demos work with no env file. |
| `OPS_PASSWORD` | Yes | Password for `/ops` (default in `.env.example`: `dispatch`) |

## Routes

| Path | Who |
| --- | --- |
| `/` `/services` `/about` `/contact` `/faqs` | Marketing, KC copy |
| `/book` | Guided booking wizard |
| `/contractors` | Approved contractor directory |
| `/contractors/[slug]` | Public profile (approved only) |
| `/contractors/signup` `/join` | Licensed contractor application |
| `/account` | Private customer profile (email + phone after first book) |
| `/status` `/status/[token]` | Customer job status |
| `/ops` | Jobs, contractor review, customers, TOD payments |
| `/api/bookings` | Create booking |
| `/api/contractors` | Public list (approved) + signup POST |
| `/api/status/[token]` | Lookup by job ID or token |
| `/api/ops/*` | Authenticated jobs + contractor review |

## Out of scope (v1)

Real Stripe or SMS, a contractor mobile app that accepts jobs, and any UK WordPress sites.
