/**
 * Lincoln Brief — Service Worker
 *
 * Strategy:
 *  - HTML navigations  → network-first, fall back to cache, then /offline.html
 *  - Static assets     → cache-first (CSS, JS, images, fonts)
 *  - API + market data → network-only (always live)
 *
 * Bump VERSION whenever you change this file or want to flush old caches.
 */
const VERSION = 'v1.0.0';
const HTML_CACHE = `lb-html-${VERSION}`;
const ASSET_CACHE = `lb-assets-${VERSION}`;
const SHELL = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(HTML_CACHE).then((cache) =>
      cache.addAll(SHELL).catch(() => {
        /* Some shell URLs may 404 in early dev — don't block install. */
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== HTML_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

const isHtmlRequest = (req) =>
  req.mode === 'navigate' ||
  (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));

const isApiOrLive = (url) =>
  url.pathname.startsWith('/api/') ||
  url.pathname.startsWith('/keystatic') ||
  url.pathname.endsWith('/market-snapshot.json');

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isApiOrLive(url)) return; // let the network handle it

  if (isHtmlRequest(req)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(HTML_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await caches.match(req);
          if (cached) return cached;
          const offline = await caches.match('/offline.html');
          if (offline) return offline;
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh.ok && fresh.type === 'basic') {
          const cache = await caches.open(ASSET_CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        return cached || new Response('', { status: 504 });
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
