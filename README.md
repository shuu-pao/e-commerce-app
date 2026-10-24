# caracebu

The cashier app for caracebu: sell at events on an iPad, add products on a computer,
see orders and reports. It's an installable web app (no App Store), it keeps selling
with no internet, and it syncs the iPad and the computer through Supabase's free plan.

Decisions and the reasons behind them are in [docs/BRIEF.md](docs/BRIEF.md).

## Try it

```bash
npm install
npm run web          # opens http://localhost:8081
```

Without Supabase keys the app runs on that one device: no sign-in, no sync. Tap
**Try it with sample products** on the empty Sell screen to fill it with the products
from the mock.

**Testing with `.env` filled in:** `npm run web:local` (http://localhost:8083) ignores the
keys and runs device-only, so testing never touches the shop's live data. The sidebar says
**On this device only**; if it doesn't, stop and check before changing anything.

## Checks

```bash
npm test             # money, discounts, split payment, stock, reports, CSV, sync merging
npm run test:db      # the Supabase migration in real Postgres (PGlite): access rules, uploads
npm run typecheck    # needs .expo/types: run `npx expo start` once first
npx expo lint
npm run build:web    # production build + service worker in dist/
```

## Set up syncing (Supabase, free plan)

1. At [supabase.com/dashboard](https://supabase.com/dashboard), **New project**:
   - Organization: your personal one (Free plan)
   - Project name: `caracebu`
   - Database password: **Generate a password**, save it in your password manager (the app
     never uses it; you'd need it only to connect a database tool)
   - Region: **Southeast Asia (Singapore)**, the closest to Cebu
   - Security options: keep the **Data API** turned on (the app talks to it)
   - **Create new project**, then wait a couple of minutes.
2. **SQL Editor › New query**: paste all of `supabase/migrations/20261022000000_records.sql`,
   **Run**. Expect "Success. No rows returned".
3. **Authentication › Sign In / Providers**: turn off **Allow new users to sign up**, Save.
4. Create the owner's login **by invitation**, so only the client knows the password. Do it
   after publishing (see "Publish the website"), because the email links to the live site:
   - **Authentication › URL Configuration**: Site URL `https://caracebu.expo.app` (your
     published address). Under Redirect URLs add the same address, plus
     `http://localhost:8081` for testing on your computer. Save.
   - **Authentication › Users › Add user › Send invitation**: the client's email, **Invite**.
   - Copy the new user's **User UID** (it's listed right away), then in the SQL Editor run:
     ```sql
     insert into public.shop_owners (user_id) values ('PASTE-USER-UID-HERE');
     ```
     Only users in `shop_owners` can read or write the data.
   - The client opens the email and taps the link: the app shows **Welcome! Choose your
     password**. After that they sign in with their email and that password.
   - For your own testing, **Add user › Create new user** (tick **Auto Confirm User**) with
     your email works the same way; add that UID to `shop_owners` too, and delete the test
     user before handing over.
   - Forgotten password: **Forgot password?** on the sign-in screen emails a reset link.
     Signed in, **Change password** is in the sidebar. The free plan sends only a few auth
     emails per hour.
5. Copy `.env.example` to `.env`. From the project's **Connect** dialog (or **Project
   Settings › API Keys**) copy the **Project URL** into `EXPO_PUBLIC_SUPABASE_URL` and the
   **publishable** key (`sb_publishable_…`; the legacy `anon` key also works) into
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Never the secret / service_role key.
6. Restart `npm run web`. The app now asks to sign in; after signing in the sidebar shows
   **Online · Everything is synced**.

**Tighter sign-in limit (recommended).** In **Authentication › Rate Limits**, set the
token limit (sign-ins and token refreshes) to **30 requests per 5 minutes** instead of 150.
One shop with a couple of devices never needs more, and it slows down password guessing.

**Updating the database.** `supabase/migrations/20261022000000_records.sql` is safe to run
again: paste the whole file into **SQL Editor** and **Run** after it changes.

**Keeping the free project awake.** Supabase pauses a free project after a week without
use. `.github/workflows/keep-supabase-awake.yml` pings it every 3 days: add
`SUPABASE_URL` and `SUPABASE_ANON_KEY` as repository secrets (Settings › Secrets ›
Actions). GitHub stops schedules in a public repo after 60 days without commits; re-enable
it from the Actions tab if that happens.

## Publish the website

```bash
npm run build:web
npx eas-cli@latest deploy        # EAS Hosting (free plan); add --prod for the main address
```

Any other static host works too if it sends every unknown path to `/index.html` (it's a
single-page app). The `EXPO_PUBLIC_SUPABASE_*` values are baked in at build time, so set
them in `.env` before `npm run build:web`.

## The public catalog

Anyone who opens the site without signing in sees the catalog: the products switched to
**Show in catalog** on Edit product (off for new products), with prices, colours and
"Sold out" / "Low on stock" (5 pieces or fewer), never the stock count. **Message us on
Instagram** opens instagram.com/caracebu, and **Shop owner? Sign in** at the bottom opens the
sign-in screen. A device that has synced before (the owner's iPad or computer) opens on
sign-in instead.

- Visitors read one database function, `public.catalog()`; everything else stays owner-only.
- Photos: after each sync the owner's device copies catalog photos to the public `catalog`
  storage bucket, named by their SHA-256, so visitors load cached images instead of pulling
  photos through the database. A newly switched-on product's photo appears once the owner's
  device has synced.
- Needs the current migration (it creates the function, the bucket and its upload rules).

## Install on the iPad

Open the site in **Safari**, tap **Share › Add to Home Screen › Add**. Then open it **from
the new icon** and sign in there: on iPad the Home Screen app keeps its own storage, separate
from Safari, so signing in inside Safari doesn't carry over. Open it once on Wi-Fi before an
event so it downloads everything.

- Sales made offline are saved on the iPad and marked *Not synced*; they upload by
  themselves when the internet is back. The sidebar shows how many are waiting.
- Don't clear Safari's website data or delete the app while orders are waiting, and
  sign-out is blocked until they've uploaded.
- When a new version is published, the sidebar shows **A new version is ready · Reload**.

## How it fits together

```
src/app/        screens (Expo Router): sell, checkout, orders, home, reports, products, categories, events
src/domain/     pure logic with tests: money, totals, discounts, payments, stock, reports, CSV
src/data/       store.ts (records + outbox, saved on the device), sync.ts (Supabase), catalog.ts (public catalog), storage.*.ts
src/ui/         shared components and the design tokens from the mock
scripts/        icons.py: rebuilds the 3 KB icon font (add an Ionicons name, run it)
supabase/       database schema and access rules
public/         index.html (service worker registration), manifest, icons
```

- **Offline first.** Every change is saved on the device (IndexedDB on the web) and put
  in an outbox. `sync.ts` uploads the outbox and downloads the other device's changes
  whenever there's a connection. The newer change wins.
- **Stock** is never stored as a number that two devices could overwrite. It's worked out
  from stock changes (what the seller counted) minus what orders sold, so sales on an
  offline iPad and edits on the computer add up correctly after syncing.
- **Order numbers** continue from the highest known number. If two offline devices pick the
  same number, the server gives the later upload the next free number.
- **Photos** are cropped square and shrunk to 600 px on the device and stored inside the
  product record, so they work offline with no storage bucket.
