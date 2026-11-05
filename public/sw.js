/**
 * Service worker of the installed app: the game opens and runs offline.
 * - Hashed build files (`assets/`): cache first, stored on first use (a new build has new names).
 * - Everything else of this site (the page, the .glb models and their manifest, icons): network first,
 *   so a new version arrives when online; the cached copy offline. Their names do not change.
 * Bump VERSION to drop old caches.
 */
const VERSION = 'v3';
const CACHE = `jerusalem-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icons/icon-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('jerusalem-') && k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const hashed = new URL(req.url).pathname.includes('/assets/');
  if (!hashed) {
    const key = req.mode === 'navigate' ? './' : req;
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(key, copy));
          }
          return res;
        })
        .catch(() => caches.match(key).then((hit) => hit || Response.error())),
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
