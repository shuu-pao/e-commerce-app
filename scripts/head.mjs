// Runs after `expo export` (npm run build:web): lets the first visit fetch in parallel instead
// of one thing after another. Without it the catalog request waits for the app's 470 KB of
// code, then the fonts, then a render; on slow 4G that put products at 5.3 s (2026-11-05).
// - starts the visitor's catalog request at once (src/data/catalog.ts picks it up);
// - preloads the fonts the app waits on before it shows anything;
// - opens the connection to Supabase early for the photos.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

try {
  process.loadEnvFile('.env');
} catch {} // no .env: CI-style env vars, or a device-only build

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; // public: already in the app's code
const file = 'dist/index.html';

const fonts = readdirSync('dist/assets', { recursive: true })
  .map((f) => '/assets/' + f.replaceAll('\\', '/'))
  .filter((f) => f.endsWith('.ttf'))
  .map((f) => `<link rel="preload" href="${f}" as="font" type="font/ttf" crossorigin />`);

const supabase =
  url && key
    ? [
        `<link rel="preconnect" href="${url}" />`,
        `<script>window.__catalog = fetch(${JSON.stringify(url + '/rest/v1/rpc/catalog')}, { method: 'POST', body: '{}', headers: { apikey: ${JSON.stringify(key)}, Authorization: ${JSON.stringify('Bearer ' + key)}, 'Content-Type': 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });</script>`,
      ]
    : [];

const html = readFileSync(file, 'utf8');
writeFileSync(file, html.replace('</head>', [...fonts, ...supabase].join('\n    ') + '\n  </head>'));
console.log(`head.mjs: ${fonts.length} font preloads${supabase.length ? ', catalog prefetch' : ''}`);
