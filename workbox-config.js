module.exports = {
  globDirectory: 'dist/',
  globPatterns: ['**/*.{js,html,ico,json,png}'],
  swDest: 'dist/sw.js',
  // The app shell is the whole app (single-page, no routing), so a
  // cache-first strategy for every precached file is correct: once loaded
  // once, GeoFieldCamera needs zero network access to run (camera and GPS
  // are hardware, not API calls).
  //
  // Without these, a new service worker on a fresh deploy sits "waiting"
  // until every open tab/instance of the old one is fully closed, so an
  // already-installed PWA can end up stuck on a stale service worker
  // whose cached files no longer match the current deploy — this makes
  // every new deploy take over immediately instead.
  skipWaiting: true,
  clientsClaim: true,
};
