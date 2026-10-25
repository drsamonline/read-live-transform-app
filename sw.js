/* rlt service worker — offline first, but never stale.
 *
 * THE CACHE NAME IS DERIVED FROM THE APP'S OWN BYTES. It must equal
 *   'rlt-' + the first 8 hex characters of the SHA-256 of ./index.html
 * and `tests/sw.test.js` enforces exactly that. So a deploy that changes the
 * app without bumping this line FAILS THE SUITE instead of leaving every
 * returning visitor on the old build. The previous version pinned
 * 'rlt-b32da261' by hand and served the app CACHE-FIRST, which meant a shipped
 * fix could never reach a browser that had already visited once.
 */
const CACHE = 'rlt-48833fd3';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => (self.clients && self.clients.claim ? self.clients.claim() : undefined))
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  /* A NAVIGATION IS NETWORK FIRST: the live demo has to be the latest build.
   * Offline it still works — the cache is the fallback, not the default. */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const cp = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', cp));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  /* Everything else is cache first, refreshed in the background. */
  e.respondWith(
    caches.match(e.request).then(r => {
      const net = fetch(e.request).then(res => {
        const cp = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp));
        return res;
      });
      return r || net;
    })
  );
});
