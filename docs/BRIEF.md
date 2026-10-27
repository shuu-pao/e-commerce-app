# Brief and handoff — read this first

Loaded into every Claude Code session through `CLAUDE.md`. It carries what
was decided in chat. If something is decided and it isn't written here, a
new session won't know it, so record it here in the same turn.

## Status (2026-10-22)

- **The app is built (version 1, 2026-10-22)** and merged into `main`
  (pushed to GitHub). Every screen of screen plan v2 works, offline selling
  works, and tests, typecheck, lint, expo-doctor and the web build pass.
  It runs on one device until Supabase is set up (README, "Set up syncing").
  See "Build notes" below.
- **The client answered the questions page** (round 1 on 2026-10-20,
  round 2 on 2026-10-22). Answers are under Decisions below. Question 28
  is answered: checkout must work offline,
  which shapes the stack (Offline plan). All the questions (41)
  are in the Claude Doc "E-commerce app: client questions":
  https://claude.ai/code/artifact/b8bb39ae-33ae-46e7-b9a5-6da327dec0f4
  (read it with the Claude Docs connector; the developer types the client's
  answers there).
- **Mock** (clickable Design canvas):
  https://claude.ai/artifact/6YRqzABYuB7ggZm37rpgmA. v1 (phone screens)
  went to the client on 2026-10-17; v2 (2026-10-20) replaced it; v3
  (2026-10-22) adds every round 2 answer (shop name, cash change, split
  payment, online buyer details, the Online event); v4 (2026-10-24) adds
  row 4, the public catalog (computer and phone), and the Show in catalog
  switch on Edit product, approved by the client 2026-10-24; v5
  (2026-10-27) adds row 5, the client's new requests (not built, waiting
  on round 5 below). Source:
  read the canvas's files with the Artifact tool (scratchpad copies
  don't survive between sessions) and edit those.
- **Question 3 is settled** (2026-10-19): no store apps. The app ships as
  an installable web app (below).
- **Client questions page**: https://claude.ai/artifact/KZDZKxex8tdKWM3fiV1mTb.
  Round 1 (26 questions) was answered on 2026-10-20. Round 2 (2026-10-22)
  holds only the 9 still open (Open questions), numbered 1 to 9 on the
  page. Answers stay in the
  client's browser; the client copies them as text and sends them back
  through the developer, who brings them here. (A page that saves answers
  online only works for people in the owner's claude.ai organization, so
  it couldn't be used.) To edit it, read it with the Artifact tool.
- **The screen plan v2 and the offline plan are approved** by the developer
  (2026-10-20). The mock was redrawn to match them (mock v2, same link):
  iPad landscape screens for selling, desktop pages for managing.
- **Every client question is answered** (round 2, 2026-10-22). The shop
  is called **caracebu**.
- **Ownership: the app and its code belong to Paolo (the developer)**, not
  the client. Settled; don't ask about it again.
- **Live** (2026-10-22): https://caracebu.expo.app (EAS Hosting, project
  `e473654f-7eea-4415-bf97-c365ef3de33d`). Supabase project set up and
  syncing (`vcbdnggmzbtpqnldrxjl`). The live data is the client's alone:
  the developer's test login comes off `shop_owners` (2026-10-24) and
  testing never uses the live project (Testing, below). Redeploy after changes: `npm run build:web`, then
  `npx eas-cli@latest deploy --prod`.
- **The public catalog is live** (2026-10-24, mock v4 approved by the
  client): migration re-run in Supabase, deployed; caracebu.expo.app shows
  the catalog to visitors. See "Public catalog" below and README. Still to
  check: a real product switched on, with its photo uploaded.
- Next: Supabase Site URL and redirect URLs, invite the client, install on
  the iPad (README). The keep-awake ping works (GitHub secrets set, tested 2026-10-22).

## Build notes (version 1, 2026-10-22)

How the code is laid out is in README.md ("How it fits together"). What a
new session needs to know beyond that:

- **Web output is `single`** (one-page app) so the service worker can serve
  it offline; any host must send unknown paths to `/index.html`.
  `npm run build:web` = `expo export` + Workbox (`workbox-config.cjs`). New
  versions wait for the seller to tap Reload in the sidebar.
- **Data**: every record is saved on the device first (IndexedDB on the
  web, SQLite key-value on native) with an outbox; `src/data/sync.ts`
  pushes through the `push_records` function and pulls rows newer than the
  last server time it saw. Newer `updatedAt` wins.
- **Stock** = sum of stock changes (`stock` records, what the seller
  counted) minus pieces in non-deleted orders. No stored count, so offline
  sales and desktop edits can't overwrite each other.
- **Order numbers**: highest known + 1. If two offline devices clash, the
  server renumbers the later upload.
- **Photos**: cropped square, 600 px JPEG, stored as data URLs inside the
  product record (works offline, no storage bucket). If the 500 MB
  database ever gets close to full, move them to Supabase Storage.
- **Access**: row-level security allows only users listed in
  `shop_owners`; sign-ups should stay off. Only the anon key is in the app.
- **Logins**: no sign-up screen. The owner joins by a Supabase invitation
  email; the link opens the app on "Choose your password" (`src/ui/SetPassword.tsx`,
  web only, implicit flow, the link type is read from the address before
  supabase-js consumes it). "Forgot password?" on sign-in and "Change
  password" in the sidebar use the same form. Supabase's Site URL must be the
  published address. Safeguards (from a security review): a link for a different
  account than the one signed in is refused; link error text is never
  shown (fixed wording only); Change password asks for the current one and
  signs out other devices; when the server rejects a login, the device goes
  back to the sign-in screen and keeps its unsent orders.
- **Device-only mode**: with no `EXPO_PUBLIC_SUPABASE_*` values the app
  runs without sign-in or sync, and offers sample products (from the mock).
- **Typecheck** needs the generated route types: run `npx expo start` once
  (it writes `.expo/types`), then `npm run typecheck`.
- **Tests**: `npm test` runs `src/domain/*.test.ts` with Node's built-in
  runner (Node 23.6+ runs TypeScript directly; domain files import each
  other with `.ts` extensions for that reason). It covers money, discounts,
  split payment and change, stock, reports, CSV, and the sync merge rules
  (`src/domain/merge.ts`). `npm run test:db` runs the Supabase migration in
  real Postgres (PGlite) and checks access rules, newest-wins uploads and
  order renumbering.
- **Tested against the live Supabase project** (2026-10-22): sign-in and
  the first sync (about 2 s on slow 4G). **Not tested yet**: the app on a
  real iPad (tested in Chromium at iPad landscape, iPad portrait and phone
  sizes, plus offline with the server stopped).
- Device clocks: newest-wins trusts each device's clock. The server
  renumber always stamps newer than the upload, and a device never stamps a
  record older than its last change.
- **Loading** (measured 2026-10-22, first visit, empty cache): the page
  paints a skeleton of the Sell screen from `public/index.html` before any
  JavaScript (0.4 s even on 3G, was a white screen for 1.2 s on Wi-Fi and
  7 s on 3G); `_layout.tsx` fades it out once the app is ready. Later
  visits open from the service worker in under a second. A device's first
  download after sign-in shows skeleton cards/rows (`src/ui/Skeleton.tsx`).
  Async routes are off (`app.json`): every screen ships in one bundle, so
  moving between screens never waits on the network (about 50 ms on slow
  4G). Icons come from a 3 KB subset font (`scripts/icons.py`) instead of
  the 390 KB Ionicons font.
- **Monkey testing** (2026-10-22): 2,500 random actions in device-only
  mode (taps, junk input, back, reload, resizing). No crashes, console
  errors or blank screens; one bug found and fixed ("undefined" flashing in
  fading delete dialogs). Script: `scripts/monkey.js` (how to run it is at
  its top); always against a device-only dev server, never the live data.
- **Rate limiting** (2026-10-23). Supabase Auth limits per network (sign-in
  attempts via /token, reset/verify links) and allows only 2 emails per hour
  per project with its built-in sender (invitations and resets share it).
  On top of that: the sign-in screen pauses 30 s after 5 wrong passwords
  (doubling, up to 5 min); "Send again" for a reset link waits 60 s; sync
  backs off from 1 to 15 minutes while it keeps failing (tapping the sync
  box retries at once); `push_records` refuses more than 500 records per
  upload or a record over 4 MB, and the app uploads at most 200 at a time.
  The migration file is safe to re-run; re-run it to apply changes.
- **Logo** (2026-10-27): the caracebu logo is "cara / cebu" in Shrikhand
  (free Google Font), red `#EE3C4C` on pink `#FEEBE7`. `scripts/brand.py`
  subsets the font to the letters of "caracebu" (`assets/fonts/brand.ttf`,
  3 KB, `Txt variant="brand"`), inlines it in `public/index.html` for the
  skeleton, and draws the Home Screen icons (`public/icons`, letters inside
  the maskable safe circle). The browser tab icon stays the placeholder
  "c" (`assets/images/favicon.png`) and buttons stay berry, per the client.
  Proposal page: https://claude.ai/artifact/FMhZmyUuQEQSUkzde9PhzY.
- `npm audit` lists issues in Expo's build tooling (config plugins), not in
  code that ships to the browser; they clear with Expo SDK updates.

## Testing (2026-10-24)

The live Supabase project holds the client's real data; never test there,
and never put a test login in `shop_owners`. Supabase's free plan allows
two projects and the developer has none left, so there is no test project.
Test with: device-only mode (`npm run web:local`, port 8083; it blanks the
Supabase keys, which typing them empty in PowerShell can't do), `npm run test:db`
(the migration in PGlite), and stubbed network responses in Playwright.
If sync or sign-in ever need a real server, run Supabase locally (Supabase
CLI, needs Docker); not set up.

## Who's who

- **The developer** (Paolo, repo owner, GitHub `shuu-pao`) builds this for
  a **client**, and the client's requirements reach us through the
  developer. The app and its code belong to the developer.
- When a requirement is ambiguous, don't settle it yourself. Write the
  question down for the developer to ask the client.

## The client's request (verbatim, 2026-10-17)

> sort of like an e commerce app in which the back end can upload products
> and add a title to a product as well as description and price. and the
> user can add categories such as pouches/hairclips/bags/accessories and
> there is a "hamburger" dropdown on the left that shows home page, all
> products, categories: pouches hairclip bags accessories, all orders (sort
> of like a reporting style, per order per row). And when opening a
> product, the user can add to cart, add quantity if possible, and add
> quantity from the cart, and in the cart view, they can breakdown the
> order with price shown on the right side, and in the same cart view, can
> see total order/total price, and check out with order number, and each
> order can have a view summary or something

The developer's note: the client wants it as an app and as a website.

What we know now (2026-10-17): the client sells their own products at
events. The app is their cashier tool (reading A, like Loyverse POS), and
only the client uses it. Before an event they add products and photos on a
desktop computer. At the event they check out on an iPad. The client's
replies to the mock were screenshots in Cebuano and English, sent through
the developer.

## Open questions

The client answered round 4 (the logo) on 2026-10-27 (Decisions below).
New client questions get batched here and asked all at once; never
trickle them out one reply at a time.

Round 5 (2026-10-27, in the mock's row 5 and its orange note; not sent
yet). The client asked for: several photos on a product and on each
colour; categories to pick on top of Products, like the catalog; the
catalog opening on the main product photos first. Mock v5 proposes: up
to 6 product photos (the first is the cover, "Make cover" reorders) and
3 per colour; category chips plus "No category" filtering the Products
list; a catalog gallery (big photo plus small ones) that starts on the
product photos, shows only the picked colour's photos, and goes back on
a second tap. Cashier screens and receipts keep one photo: the colour's
first. Limits behind the numbers: photos live in the product record
(about 60 to 90 KB each) and `push_records` refuses a record over 4 MB;
Shopee allows 9 photos per product, Shopify one photo per variant.
1. Products: is picking a category at the top to show only those
   products what you meant?
2. Are up to 6 photos per product and 3 per colour enough?
3. Catalog: when a colour is picked, show only that colour's photos, or
   all photos in one row?
4. Descriptions: the client typed `**Details**` for bold, and the
   catalog shows the asterisks. Show bold, or remove the asterisks?

## Public catalog (built 2026-10-24)

What it shows (client, round 3): title, photo, description, price,
colours. Never the stock count: a colour or product with no stock shows
"Sold out" (and stays listed), and 5 pieces or fewer shows "Low on stock".
Only products with "Show in catalog" switched on appear (a switch on Add
or edit product). A "Message us on Instagram" button opens
https://instagram.com/caracebu (the profile, not a direct message).
Developer-level defaults, shown in the mock for the client's OK: the
switch starts off for new and existing products; the labels show per
colour, and on the product card when the whole product is sold out or
has 5 pieces or fewer in total.

The client wants a public page that shows all the products with no login,
on the same host if possible, using the app's stock. Plan (developer
agreed): same app and address (caracebu.expo.app). No login shows the
catalog, with a small "Shop owner? Sign in" link; the owner's login
(`shop_owners`) shows the cashier app as now. No customer accounts;
sign-ups stay off.
- Visitors read through one read-only database function that returns only
  products, categories and stock. Orders, events and reports stay
  owner-only; the access rules stay as they are.
- Photos: copy each one to a public Supabase Storage folder when it syncs,
  so visitors load ordinary cached images. The app keeps its own copies in
  the records, so offline selling doesn't change. Without this every
  visitor pulls 20+ MB through the database (5 GB free egress a month),
  and a busy Instagram post could get the project restricted, which stops
  the cashier too.
- Catalog screens reuse the Sell grid and search, without the cart.
- Rejected: a separate static site rebuilt every hour (the client asked
  for the same host, and its stock would lag by up to an hour).
- Trade-offs: visitors download the app's code (1.7 MB before
  compression); link previews are the same for every product (one-page
  app).
- Build notes: `public.catalog()` computes stock the same way as the app
  (stock changes minus pieces in non-deleted orders) and returns only
  'out'/'low'. Photo files are named by the SHA-256 of the data URL on
  both sides (`catalog_photo_path()` in SQL, `src/data/catalog.ts`); each
  device remembers what it uploaded (`settings.publishedPhotos`); old files
  are never deleted (fine until ~10,000 photos). A device that has synced
  before (`lastPulledAt`) opens on sign-in, everyone else on the catalog
  (`Gate` in `_layout.tsx`); the outbox can't tell them apart because every
  new device queues the Online event. The browser's Back button closes an
  open product. Tested: `npm run test:db` (catalog rules, photo names,
  upload rights) and in Chromium at desktop and phone sizes with sample
  data; not yet against the live project.

## Offline plan (approved 2026-10-20)

The client: "Not all venues have good wifi... I can save offline and it can
update when i get home with wifi" (question 28). Loyverse works the same
way: offline receipts are stored on the device, marked "Unsynced", and sync
by themselves when the internet is back; sign-out is blocked while any are
unsynced.

- Before an event, on Wi-Fi: the iPad downloads the products, photos and
  stock.
- At the venue: checkout works with no internet. Orders are saved on the
  iPad, marked "Not synced", and stock counts down on the iPad.
- Back online: unsynced orders upload by themselves, and the server takes
  the stock down. A small badge shows how many orders still wait.
- Build: a service worker (Workbox) keeps the app and photos on the iPad;
  orders wait in IndexedDB until sent; the app asks for persistent storage
  (`navigator.storage.persist()`), which WebKit grants by heuristics such
  as being a Home Screen web app. No sync service, so no cost.
- Risks to tell the client: unsynced orders exist only on the iPad, so
  don't clear Safari's data or delete the app icon before they sync, and
  sign-out is blocked until then. While offline, the iPad doesn't see
  edits from the desktop or online orders (question 5).
- Online orders do come in during events (client, 2026-10-22), so an
  offline iPad can sell a piece an online order already took. Default
  (developer-level, no client question): the sale still saves; when it
  syncs and stock would drop below zero, the product is marked "Oversold
  by N" for the client to fix.
- Sources: https://help.loyverse.com/help/offline-work-of-pos,
  https://webkit.org/?p=14403

## Stack (decided 2026-10-17; offline per the plan above)

- **How it ships (2026-10-19): an installable web app (PWA), no store
  apps.** The client opens the site in Safari on the iPad, taps Share, then
  Add to Home Screen. Since iPadOS 26 every site added that way opens as a
  web app (full screen, own icon). Same on Android (Chrome) and desktop
  (Chrome, Edge). Free: no Apple fee, no Google Play fee. Expo supports
  this with standard web files: `public/manifest.json` (name, icons,
  `"display": "standalone"`), linked from `src/app/+html.tsx`. A service
  worker (Workbox) is needed for offline use (question 28). Expo's docs
  warn that aggressive caching can stop updates reaching users, so the
  worker must check for a new version on each launch. Expo
  still fits: the same code builds the website, and a store app stays
  possible later. Sources:
  https://docs.expo.dev/guides/progressive-web-apps/,
  https://webkit.org/?p=16993

- **Expo SDK 58** (React Native, Expo Router, React Native Web) in
  TypeScript. One codebase builds the Android app, the iPhone and iPad app
  and the website. The menu is a drawer on a phone and a sidebar that stays
  visible on a wide screen. Expo Router includes the drawer from SDK 56.
- **Supabase** (Postgres, logins, storage for product photos). Not set up
  yet. Question 37 is answered: the iPad and the desktop share the same
  data, so an online database is needed. The data can't live on one device.
- Why Expo: EAS builds the iPhone app in the cloud, so it works from Windows
  with no Mac. It's a real native app (Apple's guideline 4.2 rejects apps
  that only wrap a website). It's TypeScript, like the developer's other
  project. Shopify chose React Native for its mobile apps in 2020.
- Rejected:
  - Next.js + Capacitor: building for iPhone needs a Mac, and there's the
    4.2 risk.
  - Flutter: Dart is a new language, and its web version is weak for search.
  - Firebase instead of Supabase: since 3 February 2026, photo storage
    (Cloud Storage) needs the Blaze plan, which means a billing account
    with a card. The usage itself can stay free, but that cuts against the
    client's zero-cost wish.
- Costs:
  - Expo free plan: up to 15 Android and 15 iOS builds; EAS Hosting covers
    100,000 requests a month, with no custom domain.
  - Apple Developer Program (US$99 a year) and Google Play (US$25 once):
    not needed, since there are no store apps.
  - Supabase free plan (checked 2026-10-17): 500 MB database, 1 GB file
    storage, 5 GB egress, and no automatic backups. A free project
    **pauses after one week without use** and stays down until someone
    restores it from the dashboard. An event seller may go weeks between
    events. Plan: ping the database every few days on a schedule. A GitHub
    Actions schedule is free, but GitHub turns schedules off in a
    **public** repo after 60 days with no activity, and the client is fine
    with the repo staying public (question 35). So the ping runs somewhere
    else, or the repo gets a commit at least every 60 days. Decide when
    Supabase is set up.
- Sources: https://expo.dev/pricing, https://expo.dev/changelog,
  https://supabase.com/pricing,
  https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows,
  https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024,
  https://help.loyverse.com/help/make-sales,
  https://help.loyverse.com/help/how-create-and-configure-discounts,
  https://community.squareup.com/t5/Archived-Discussions-Read-Only/Updated-iPad-checkout-screen-is-unreadable-and-unnecessary/m-p/376170,
  https://docs.expo.dev/router/advanced/drawer,
  https://www.infoq.com/news/2020/02/shopify-using-react-native/,
  https://www.technetexperts.com/guideline-4-2-minimum-functionality/,
  https://theflutterk.it.com/blog/flutter-web-2026-production-ready

## Screen plan v2 (approved 2026-10-20)

Built from the request and the client's answers. Numbers in brackets are
questions in the doc. Changes from v1: one tap adds to the cart, so the
product page leaves the selling flow (39); the cart sits beside the
products on the iPad (41); new Reports and Events screens (12, 23, 38).

Selling, on the iPad at events:

The app opens on Sell > All products, never on Home, so people at the
table don't see the sales (client, 2026-10-22). Every order line (cart,
Checkout, Order placed, Order summary) starts with a square photo.

1. **Sell** (All products and each category): a search bar, then a grid
   of product cards with the price and the stock left. The cart sits in a
   column on the right (41). One tap adds a product (39); if it has
   several colours, a small picker lists them with their stock, and a
   colour that ran out shows "Sold out" (8). The cart: one line per
   product and colour, with its photo, + and - and remove (14), Total order in pieces
   (15), Total price, Check out. A badge shows orders not yet synced (28).
2. **Checkout**: the event (38), a discount (none, 10%, a percent typed
   in, or a peso amount typed in), the payment method (Cash, GCash, QR
   code, BPI), the total after the discount, Place order. Payment can be
   split across methods (43). For cash, type the amount received and the
   app shows the change (42). When the event is "Online": the buyer's
   name, address and a delivery fee (5).
3. **Order placed**: the receipt on screen (20): order number, lines,
   discount, payment, total, then New order.
4. **All orders**: one row per order: order number, date and time, items,
   payment method, discount, total (22). Filter by dates or event;
   Download to Excel (23).
5. **Order summary**: the receipt again, plus Edit order (24). No print
   (25).
6. **Edit order**: the Sell screen opened on a past order. Saving updates
   the order and puts the stock right.
7. **Home**: a dashboard: today's sales, best sellers, and shortcuts to
   the reports (12). Opened from the menu only. Peso amounts show as
   "₱ ••••" until Show amounts is tapped, and hide again on leaving Home.
8. **Reports**: totals per day, week, month, event and chosen dates, best
   sellers, Download to Excel (12, 23).

Managing, on the desktop before events:

9. **Products and Add or edit product**: one product photo (6), title,
   description, one price (40), categories, several allowed (9), colours,
   each with its own stock count and photo. Delete (10).
10. **Categories**: add, rename, delete (10).
11. **Events**: add an event and choose the current one (38). Used on the
    iPad on the day, so it's in the iPad menu too. A permanent "Online"
    event holds online orders.

Other:

12. **Sign in**: one login for the client. Sign-out is blocked while
    orders wait to sync (28).

Menu: Home, Sell (All products, then the categories), All orders,
Reports, then Products, Categories and Events (on both devices). On the iPad
and the desktop it's a sidebar that stays open.

## Repo and running

- GitHub: https://github.com/shuu-pao/e-commerce-app, **public**; the
  client is fine with that (question 35). Default branch `main`.
- Never commit secrets: `.env*` is ignored. The Supabase service-role key
  never goes in the app; only the anon key goes in the app, and row-level
  security protects the data.
- Run it with `npm run web` (browser) or `npx expo start`, then scan the QR
  code with Expo Go on an Android phone or an iPhone.
- Checks before calling anything done: `npx tsc --noEmit`, `npx expo lint`,
  `npx expo export --platform web`.

## Decisions

| Date | Decision |
| --- | --- |
| 2026-10-17 | Stack: Expo SDK 58 + Supabase, one codebase for Android, iPhone, iPad and web (above) |
| 2026-10-17 | Placeholder name "e-commerce-app" until the client gives a shop name (given 2026-10-22: caracebu) |
| 2026-10-17 | "The back end" means the app's inner workings, not a person or a separate admin site (client, question 2) |
| 2026-10-17 | No strict deadline (client, question 4) |
| 2026-10-17 | Use only free services, with no running or maintenance costs (client, question 4) |
| 2026-10-17 | Reading A: the client's own cashier-style sales tool. Only the client uses it, with one login (client, questions 1 and 26). Questions 18, 21, 27 and 33 no longer apply |
| 2026-10-17 | Devices: a desktop before events to add products and photos; an iPad at events to check out. Both share the same data, so the app needs an online database (client, questions 29, 30, 37) |
| 2026-10-17 | A product can come in several colours, each with its own stock count (client, question 7) |
| 2026-10-17 | The app counts stock. Quantity can't go above the stock left, and the client keeps the counts right (client, questions 8 and 13) |
| 2026-10-17 | A search bar on All products and on each category page (client) |
| 2026-10-17 | Discount at checkout: 10%, a percent typed in, or a peso amount typed in (client, question 16) |
| 2026-10-17 | The payment method is picked at checkout: Cash, GCash, QR code or BPI (client, question 17) |
| 2026-10-17 | Order numbers look like 0042, for now (client, question 19) |
| 2026-10-17 | Orders can be edited after checkout, because a buyer may swap an item after paying (client, question 24) |
| 2026-10-19 | No App Store or Google Play apps: the app must cost nothing. It ships as an installable web app, added to the iPad's Home Screen from Safari (developer, question 3) |
| 2026-10-20 | Checkout must work offline at venues with weak internet; orders sync later on Wi-Fi (client, question 28). How: the Offline plan (approved by the developer) |
| 2026-10-20 | Screen plan v2 approved by the developer |
| 2026-10-20 | All colours of a product share one price (client, question 40) |
| 2026-10-20 | On the iPad, the cart sits beside the products, and one tap adds a product (client, questions 41 and 39) |
| 2026-10-20 | A colour that runs out shows "Sold out" (client, question 8) |
| 2026-10-20 | A product can be in several categories (client, question 9) |
| 2026-10-20 | Products and categories can be changed and removed; past orders keep the name and price they sold at (client, question 10) |
| 2026-10-20 | 50 to 200 products (client, question 11) |
| 2026-10-20 | Home is a dashboard: best sellers and shortcuts to reports (client, question 12) |
| 2026-10-20 | The cart can lower quantities and remove items; Total order counts pieces (client, questions 14 and 15) |
| 2026-10-20 | Receipt shown on the iPad screen only for now; no printing (client, questions 20 and 25) |
| 2026-10-20 | No BIR official receipts (client, question 34) |
| 2026-10-20 | All orders columns: order number, date and time, items, payment method, discount, total (client, question 22) |
| 2026-10-20 | Reports: totals per day and for chosen dates, download to Excel (client, question 23) |
| 2026-10-20 | Each order records its event, for totals per event (client, question 38) |
| 2026-10-20 | Free web address; English only; the repo stays public (client, questions 31, 32, 35) |
| 2026-10-20 | Paolo (the developer) maintains the app after launch (client, question 36) |
| 2026-10-22 | Every order line starts with a square photo: cart, Checkout, Order placed, Order summary (client, on mock v2). Which photo for a colour waits on question 6 |
| 2026-10-22 | The app opens on Sell > All products, not Home, so people at the table don't see the sales; Home stays in the menu (client, on mock v2) |
| 2026-10-22 | Home hides its peso amounts until Show amounts is tapped (developer, for the client's privacy concern) |
| 2026-10-22 | Shop name: caracebu. No logo or colours given, so the mock's look stays (client, question 31) |
| 2026-10-22 | The app and its code belong to Paolo (the developer), who also maintains it (client and developer, question 36) |
| 2026-10-22 | Online orders come from Instagram, also during events. They record the buyer's name, address and a delivery fee, and go to a permanent "Online" event, reported by day, week or month (client, questions 5 and 38) |
| 2026-10-22 | Events are added on the iPad on the day and picked once ("Selling at: ...") until changed (client, question 38) |
| 2026-10-22 | Cash payments: type the cash received, the app shows the change (client, question 42) |
| 2026-10-22 | Split payment: one order can be paid across several methods (client, question 43) |
| 2026-10-22 | Photos: one per product, plus one per colour (client, question 6) |
| 2026-10-22 | Reports set confirmed: per day, week, month, event or chosen dates, best sellers, payment methods, Excel download (client, questions 12 and 23) |
| 2026-10-22 | Only Home hides amounts; All orders and Reports show them (client) |
| 2026-10-22 | Web output `single`; offline through a Workbox service worker; updates wait for Reload (build) |
| 2026-10-22 | Stock is a ledger (stock changes minus sold pieces), not a stored number, so two devices can't overwrite each other (build) |
| 2026-10-22 | Photos stored in the product record as small square JPEGs (build) |
| 2026-10-22 | Only users in `shop_owners` can read or write; sign-ups off (build) |
| 2026-10-22 | The owner joins by invitation and sets their own password; forgot and change password in the app; no public sign-up (developer) |
| 2026-10-23 | Rate limiting: Supabase's auth limits plus app-side sign-in cooldown, reset-email cooldown, sync back-off, and upload size limits in the database (build) |
| 2026-10-24 | Public catalog in the same app and address: no login shows the catalog, the owner's login shows the cashier; no customer accounts (client asked, developer agreed) |
| 2026-10-24 | The live data belongs to the client's login only; the developer's test login is removed from `shop_owners`, and testing stays off the live project (developer) |
| 2026-10-24 | Mock v4 (public catalog) approved by the client; catalog built (build) |
| 2026-10-24 | Catalog shows prices; "Sold out" and "Low on stock" (5 pieces or fewer) instead of stock counts; only products switched to "Show in catalog"; a "Message us on Instagram" button opens instagram.com/caracebu (client, round 3) |
| 2026-10-27 | Logo in the app: wordmark in the catalog header, sidebar, sign-in and loading screen; the full logo as the Home Screen icon. The browser tab icon and the berry buttons stay as they are (client, round 4) |
| 2026-10-27 | A catalog product opens on its own photo with no colour picked; tapping a colour shows that colour's photo, tapping it again unpicks it (client) |
