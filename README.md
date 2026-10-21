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

## Checks

```bash
npm test             # money, discounts, split payment, stock, reports, CSV, sync merging
npm run test:db      # the Supabase migration in real Postgres (PGlite): access rules, uploads
npm run typecheck    # needs .expo/types: run `npx expo start` once first
npx expo lint
npm run build:web    # production build + service worker in dist/
```

## Set up syncing (Supabase, free plan)

1. Create a project at [supabase.com](https://supabase.com) (free plan).
2. **SQL Editor**: paste and run `supabase/migrations/20261022000000_records.sql`.
3. **Authentication › Sign In / Providers**: turn off *Allow new users to sign up*.
4. **Authentication › Users › Add user**: create the shop owner's email and password.
   Copy the new user's ID, then in the SQL Editor run:
   ```sql
   insert into public.shop_owners (user_id) values ('PASTE-USER-ID-HERE');
   ```
   Only users in `shop_owners` can read or write the data.
5. Copy `.env.example` to `.env` and fill in **Project Settings › API**: the project URL
   and the **anon** key. Never the service_role key.
6. Restart `npm run web`. The app now asks to sign in.

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

## Install on the iPad

Open the site in **Safari**, tap **Share › Add to Home Screen**. It opens full screen
with its own icon. Open it once on Wi-Fi before an event so it downloads everything.

- Sales made offline are saved on the iPad and marked *Not synced*; they upload by
  themselves when the internet is back. The sidebar shows how many are waiting.
- Don't clear Safari's website data or delete the app while orders are waiting, and
  sign-out is blocked until they've uploaded.
- When a new version is published, the sidebar shows **A new version is ready · Reload**.

## How it fits together

```
src/app/        screens (Expo Router): sell, checkout, orders, home, reports, products, categories, events
src/domain/     pure logic with tests: money, totals, discounts, payments, stock, reports, CSV
src/data/       store.ts (records + outbox, saved on the device), sync.ts (Supabase), storage.*.ts
src/ui/         shared components and the design tokens from the mock
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
