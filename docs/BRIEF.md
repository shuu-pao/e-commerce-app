# Brief and handoff — read this first

Loaded into every Claude Code session through `CLAUDE.md`. It carries what
was decided in chat. If something is decided and it isn't written here, a
new session won't know it, so record it here in the same turn.

## Status (2026-10-20)

- The project was created from Expo's SDK 58 default template, and its
  starter screens were cleared (`reset-project`). `src/app/` holds one blank
  screen. No app screens have been built yet. Typecheck and web build pass.
- **The client answered the questions page** (2026-10-20). Answers are
  under Decisions below. Six answers are unclear and wait on the client
  (Open questions). Question 28 is answered: checkout must work offline,
  which shapes the stack (Offline plan). All the questions (41)
  are in the Claude Doc "E-commerce app: client questions":
  https://claude.ai/code/artifact/b8bb39ae-33ae-46e7-b9a5-6da327dec0f4
  (read it with the Claude Docs connector; the developer types the client's
  answers there).
- **Mock** (clickable Design canvas):
  https://claude.ai/artifact/6YRqzABYuB7ggZm37rpgmA. v1 (phone screens)
  went to the client on 2026-10-17; v2 (2026-10-20) replaces it and
  follows the screen plan v2. Source:
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
- Next: the developer sends mock v2 and the six unclear answers (Open
  questions) to the client. Building can start on the parts those answers
  don't touch.

## Who's who

- **The developer** (repo owner, GitHub `shuu-pao`) builds this for a
  **client**, and the client's requirements reach us through the developer.
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

## Open questions (the ones that change the build)

Unclear answers from 2026-10-20, to take back to the client:

- **5. Online orders.** "Only at events", but the note adds online orders
  between events, recorded here to keep stock right. Where do they come in
  (Facebook, Instagram, other)? Record them like a sale at the table, or
  do they need a buyer name, address or delivery fee? Do online orders
  ever happen during an event? If so, an offline iPad can sell a piece an
  online order already took.
- **6. Photos.** "One" per product and "yes, a photo per colour". One
  product photo plus one per colour, or only one photo per colour?
- **38. Events.** Pick the event once (for example "Selling at: Christmas
  Bazaar") and every order goes to it until changed? Or pick it on each
  order? Are events set up ahead on the desktop? Do online orders count
  as their own "Online" event?
- **12 and 23. Reports.** Home should show best sellers and shortcuts to
  daily, weekly, monthly and per-event reports, but the reports answer
  ticked only per day, chosen dates and Excel. Assumed: reports cover all
  of those. Excel download = a CSV file, which opens in Excel.
- **31. Shop name.** A free address is fine, but no shop name, logo or
  colours yet.
- **36. Code ownership.** Paolo (the developer) looks after the app. Who
  owns the code wasn't answered.
- **Hiding amounts** (from mock v2 feedback, 2026-10-22). Home hides peso
  amounts until tapped; should All orders and Reports too?
- **Cash and change.** Ask how much cash the buyer gave and show the
  change, as Loyverse does?
- **Split payment.** Part cash, part GCash on one order?

This is the complete list (2026-10-22). The developer asks the client all
of it at once, so don't raise new client questions one at a time: add
them here and batch them.

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
   code, BPI), the total after the discount, Place order.
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

9. **Products and Add or edit product**: photo (6, unclear), title,
   description, one price (40), categories, several allowed (9), colours,
   each with its own stock count and photo. Delete (10).
10. **Categories**: add, rename, delete (10).
11. **Events**: add an event and choose the current one (38, unclear).

Other:

12. **Sign in**: one login for the client. Sign-out is blocked while
    orders wait to sync (28).

Menu: Home, Sell (All products, then the categories), All orders,
Reports, and on the desktop Products, Categories and Events. On the iPad
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
| 2026-10-17 | Placeholder name "e-commerce-app" until the client gives a shop name |
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
