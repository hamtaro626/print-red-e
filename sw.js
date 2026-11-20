/* Network-first, cache-as-fallback.

   The usual PWA recipe is cache-first, which is faster but serves yesterday's
   files until the cache name changes — a trap while the app is still being
   edited. This way an online phone always gets the current version, and an
   offline one still opens the app (all the work happens on the device anyway). */

const CACHE = 'print-red-e-v2';

// addAll is all-or-nothing: one 404 here rejects the install and the app loses
// offline support entirely. Every path in this list has to exist.
const SHELL = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'dpi.js',
  'prints.js',
  'logo.png',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'favicon.ico'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(name => name !== CACHE).map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(hit => hit || caches.match('index.html')))
  );
});
