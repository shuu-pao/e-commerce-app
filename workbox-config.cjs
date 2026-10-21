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
  // Wait for the seller to tap Reload, so an update never swaps code mid-sale.
  skipWaiting: false,
};
