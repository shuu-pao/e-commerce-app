// Runs after `expo export` (npm run build:web): lets the first visit fetch in parallel instead
// of one thing after another. Without it the catalog request waits for the app's 470 KB of
// code, then the fonts, then a render; on slow 4G that put products at 5.3 s (2026-11-05).
// - starts the visitor's catalog request at once: public/index.html draws the products from it
//   before the app has loaded, and src/data/catalog.ts reuses it;
// - preloads the fonts the app waits on before it shows anything;
// - opens the connection to Supabase early for the photos.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

try {
  process.loadEnvFile('.env');
} catch {} // no .env: CI-style env vars, or a device-only build

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; // public: already in the app's code
const file = 'dist/index.html';

const ttf = readdirSync('dist/assets', { recursive: true })
  .map((f) => '/assets/' + f.replaceAll('\\', '/'))
  .filter((f) => f.endsWith('.ttf'));
const fonts = ttf.map((f) => `<link rel="preload" href="${f}" as="font" type="font/ttf" crossorigin />`);
// The same font files as "Figtree", for the catalog that public/index.html draws before the app loads.
const faces = ttf
  .map((f) => [f, /Figtree_(\d00)/.exec(f)?.[1]])
  .filter(([, weight]) => weight)
  .map(([f, weight]) => `@font-face { font-family: Figtree; font-weight: ${weight}; font-display: swap; src: url(${f}) format('truetype'); }`);
fonts.push(`<style>${faces.join(' ')}</style>`);

const supabase =
  url && key
    ? [
        `<link rel="preconnect" href="${url}" />`,
        // A plain GET with the key in the address: no custom headers, so the browser skips the
        // CORS preflight round trip (public.catalog() is stable, so PostgREST allows GET).
        // Visitors only: the owner's devices show the cashier (window.__owner, public/index.html).
        `<script>window.__photos = ${JSON.stringify(url + '/storage/v1/object/public/catalog/')}; if (!window.__owner) window.__catalog = fetch(${JSON.stringify(`${url}/rest/v1/rpc/catalog?apikey=${encodeURIComponent(key)}`)}).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });</script>`,
      ]
    : [];

const html = readFileSync(file, 'utf8');
writeFileSync(file, html.replace('</head>', [...fonts, ...supabase].join('\n    ') + '\n  </head>'));
console.log(`head.mjs: ${ttf.length} font preloads${supabase.length ? ', catalog prefetch' : ''}`);
