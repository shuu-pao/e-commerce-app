# Brief and handoff — read this first

Loaded into every Claude Code session through `CLAUDE.md`. It carries what
was decided in chat. If something is decided and it isn't written here, a
new session won't know it, so record it here in the same turn.

## Status (2026-10-17)

- The project was created from Expo's SDK 58 default template, and its
  starter screens were cleared (`reset-project`). `src/app/` holds one blank
  screen. No app screens have been built yet. Typecheck and web build pass.
- **The client has replied to the mock.** Their answers are under Decisions
  below. Questions 1, 2, 4 and 37 are answered; 3 and 28 are the blockers
  now. All the questions (41 now) are in the Claude Doc "E-commerce app:
  client questions":
  https://claude.ai/code/artifact/b8bb39ae-33ae-46e7-b9a5-6da327dec0f4
  (read it with the Claude Docs connector; the developer types the client's
  answers there).
- **Mock v1** (clickable Design canvas, sent to the client):
  https://claude.ai/artifact/6YRqzABYuB7ggZm37rpgmA. It predates the
  replies: it has no stock, colours, search, checkout page, discounts,
  payment method or order editing.
- **Client questions page** (the 27 still-open questions, tap to answer,
  for the developer to send to the client):
  https://claude.ai/artifact/KZDZKxex8tdKWM3fiV1mTb. Answers stay in the
  client's browser; the client copies them as text and sends them back
  through the developer, who brings them here. (A page that saves answers
  online only works for people in the owner's claude.ai organization, so
  it couldn't be used.) Source:
  `scratchpad/client-questions/index.html` in the session that made it.
- **A screen plan is proposed** (below). It isn't approved by the developer
  yet.
- Next: the developer approves or changes the screen plan. Then update the
  mock to match it, so the client can check it, and get answers to 3 and 28.
  Don't build past the skeleton until 3 and 28 are answered.

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

The doc has 41 questions. These matter most now:

- **3.** On the iPad: the website (free), or an App Store app (US$99 a
  year)? The client wants zero running costs.
- **28.** Is there internet where they sell? If it drops at an event, must
  checkout keep working? Supabase has no offline mode built in, so offline
  checkout is extra work and may change the stack.
- **5.** Do they sell on Shopee, Lazada, Facebook or Instagram today?
- **40.** Does each colour have its own price, or do all colours share
  one? (Loyverse gives each variant its own price and stock.)
- **41.** On the iPad, should the cart sit beside the products, as in
  Square for iPad, instead of on its own screen?
- Smaller ones still open: photos per product and per colour (6), "Sold
  out" or hidden when stock runs out (8), more than one category per
  product (9, the client will decide later), Home (12), report columns and
  totals (22, 23), receipts (20), BIR receipts (34), totals per event (38),
  one-tap add (39).

## Stack (decided 2026-10-17; revisit after questions 3 and 28)

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
  - Apple Developer Program: US$99 a year. Only needed for an App Store
    app (question 3).
  - Google Play: US$25 once.
  - Supabase free plan (checked 2026-10-17): 500 MB database, 1 GB file
    storage, 5 GB egress, and no automatic backups. A free project
    **pauses after one week without use** and stays down until someone
    restores it from the dashboard. An event seller may go weeks between
    events. Plan: ping the database every few days on a schedule. A GitHub
    Actions schedule is free, but GitHub turns schedules off in a
    **public** repo after 60 days with no activity. So the repo goes
    private (question 35), or the ping runs somewhere else. Decide when
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

## Proposed screen plan (2026-10-17, not approved yet)

Built from the request and the client's replies to the mock. Numbers in
brackets are questions in the doc.

Selling, on the iPad at events:

1. **Products** (All products and each category): a search bar, then a
   grid of product cards with the price and the stock left.
2. **Product**: photos, title, price, description, a colour choice that
   shows the stock for each colour, quantity up to the stock left, Add to
   cart.
3. **Cart**: one line per product and colour, quantity up to the stock
   left, each line's price on the right, Total order and Total price, Check
   out. It's a separate screen, or beside the products on the iPad (41).
4. **Checkout** (new): a discount (none, 10%, a percent typed in, or a peso
   amount typed in), the payment method (Cash, GCash, QR code, BPI), the
   total after the discount, Place order. This matches Loyverse, where a
   discount covers the whole ticket and its value can be typed in during
   the sale.
5. **Order placed**: the order number, View summary, New order.
6. **All orders**: one row per order. Proposed columns: order number,
   date and time, items, payment, total (22).
7. **Order summary**: the lines, discount, payment and total, plus Edit
   order.
8. **Edit order**: the cart screen, opened on a past order. Saving updates
   the order and puts the stock right.

Managing, on the desktop before events:

9. **Add or edit product**: photos, title, description, price, category,
   and the colours, each with its own stock count (and price, if 40 says
   so).
10. **Categories**: add and rename, from "Add category" in the menu.

Other:

11. **Sign in**: one login for the client. The data is online, so the
    website must be locked.
12. **Home**: what it shows is still open (12).

Menu, as the client asked: Home, All products, the categories, All orders.
On the iPad and the desktop it's a sidebar that stays open.

## Repo and running

- GitHub: https://github.com/shuu-pao/e-commerce-app, **public**. Question
  35 asks the client whether that's OK. Default branch `main`.
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
