module.exports = {
  globDirectory: 'dist/',
  globPatterns: ['**/*.{js,html,ico,json,png}'],
  swDest: 'dist/sw.js',
  // The app shell is the whole app (single-page, no routing), so a
  // cache-first strategy for every precached file is correct: once loaded
  // once, GeoFieldCamera needs zero network access to run (camera and GPS
  // are hardware, not API calls).
};
