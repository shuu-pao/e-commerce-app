// Builds dist/sw.js after `expo export` (npm run build:web): the service worker that
// stores the whole app on the device so it opens and sells with no internet.
// Data (products, orders) lives in IndexedDB, not here, so the Supabase API is never cached.
module.exports = {
  globDirectory: 'dist/',
  globPatterns: ['**/*.{html,js,css,ttf,woff,woff2,png,ico,json,svg}'],
  globIgnores: ['sw.js', 'workbox-*.js', 'metadata.json'],
  swDest: 'dist/sw.js',
  navigateFallback: '/index.html',
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  // A new version takes over at once, for the next time the app opens. The open page keeps
  // running the code it loaded (one bundle, nothing loaded later), so a sale is never swapped
  // mid-way; Reload in the sidebar applies it now (public/index.html).
  skipWaiting: true,
};
