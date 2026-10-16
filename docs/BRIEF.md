# Brief and handoff — read this first

Loaded into every Claude Code session through `CLAUDE.md`. It carries what
was decided in chat. If something is decided and it isn't written here, a
new session won't know it, so record it here in the same turn.

## Status (2026-10-17)

- The project was created from Expo's SDK 58 default template, and its
  starter screens were cleared (`reset-project`). `src/app/` holds one blank
  screen. No app screens have been built yet. Typecheck and web build pass.
- **Waiting on the client.** The questions, with an Answer column to fill
  in, are in the Claude Doc "E-commerce app: client questions":
  https://claude.ai/code/artifact/b8bb39ae-33ae-46e7-b9a5-6da327dec0f4
  (read it with the Claude Docs connector; the developer types the client's
  answers there).
- Next: once the answers come in, write them under Decisions below, then
  plan the screens. Don't build past the skeleton until questions 1-3 are
  answered.

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

The developer's note: the client wants it as an app and as a website, on
any phone (Android and iPhone). The current understanding is that "the
user" is the one selling the products. That isn't confirmed yet.

## Open questions (the five that change everything)

The doc has 36 questions in all. These five come first:

1. Who uses it? A = the seller's own sales tool (like Loyverse POS), B = an
   online shop for customers (like a Shopee shop or a Shopify store),
   C = both.
2. Do "the back end" and "the user" both mean the shop owner? In the same
   app, or a separate admin site?
3. App Store and Google Play, or a website on any phone at first?
4. Budget and deadline. Who pays the running costs?
5. Do they sell on Shopee, Lazada, Facebook or Instagram today, and what
   should this app do that those don't?

## Stack (decided 2026-10-17; revisit after questions 1 and 3)

- **Expo SDK 58** (React Native, Expo Router, React Native Web) in
  TypeScript. One codebase builds the Android app, the iPhone app and the
  website. The menu is a drawer on a phone and a sidebar that stays visible
  on a wide screen. Expo Router includes the drawer from SDK 56.
- **Supabase** (Postgres, logins, storage for product photos). Not set up
  yet.
- Why Expo: EAS builds the iPhone app in the cloud, so it works from Windows
  with no Mac. It's a real native app (Apple's guideline 4.2 rejects apps
  that only wrap a website). It's TypeScript, like the developer's other
  project. Shopify chose React Native for its mobile apps in 2020.
- Rejected:
  - Next.js + Capacitor: building for iPhone needs a Mac, and there's the
    4.2 risk. It is the best choice for Google search, though. **Switch** if
    the client wants an online shop customers find on Google and no store
    apps.
  - Flutter: Dart is a new language, and its web version is weak for search.
- Costs:
  - Expo free plan: up to 15 Android and 15 iOS builds; EAS Hosting covers
    100,000 requests a month, with no custom domain.
  - Apple Developer Program: US$99 a year.
  - Google Play: US$25 once.
  - Supabase: free plan to start.
- Sources: https://expo.dev/pricing, https://expo.dev/changelog,
  https://docs.expo.dev/router/advanced/drawer,
  https://www.infoq.com/news/2020/02/shopify-using-react-native/,
  https://www.technetexperts.com/guideline-4-2-minimum-functionality/,
  https://theflutterk.it.com/blog/flutter-web-2026-production-ready

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
| 2026-10-17 | Stack: Expo SDK 58 + Supabase, one codebase for Android, iPhone and web (above) |
| 2026-10-17 | Placeholder name "e-commerce-app" until the client gives a shop name |
