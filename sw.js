cat > sw.js <<'SW'
/* sw.js — improved version (placed by assistant)
   - Robust install with per-resource handling
   - Network-first for navigation, cache-first for static assets
   - SkipWaiting via message
   - Logs prefixed with [SW]
*/

const CACHE_VERSION = 'v1.0.1';
const CACHE_NAME = `japanese-vocab-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './data/nouns.js',
  './data/verbs.js',
  './data/i_adjectives.js',
  './data/na_adjectives.js',
  './data/adverbs.js',
  './data/onomatopoeia.js',
  './data/keigo.js',
  './data/grammar.js'
];

function log(...args){ try{ console.log('[SW]', ...args); }catch(e){} }

self.addEventListener('install', event => {
  log('install', CACHE_NAME);
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const results = await Promise.allSettled(PRECACHE_URLS.map(url => fetch(url, {mode: 'no-cors'})
        .then(resp => cache.put(url, resp.clone()).catch(err => { log('cache.put failed for', url, err); }))
        .catch(err => { log('precache fetch failed for', url, err); })
      ));
      log('install precache results:', results.map(r => r.status).join(','));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', event => {
  log('activate', CACHE_NAME);
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => {
        if (k !== CACHE_NAME) {
          log('delete old cache', k);
          return caches.delete(k);
        }
      }));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // navigation requests: network-first
  if (req.mode === 'navigate' || (req.headers && req.headers.get('accept') && req.headers.get('accept').includes('text/html'))) {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(req);
        try { const cache = await caches.open(CACHE_NAME); cache.put('./', networkResponse.clone()).catch(e=>log('put failed', e)); } catch(e){ log('cache open/put failed', e); }
        return networkResponse;
      } catch (err) {
        log('network failed for navigation, trying cache', err);
        const cached = await caches.match('./index.html');
        if (cached) return cached;
        return caches.match('./') || new Response('<h1>Offline</h1>', {headers:{'Content-Type':'text/html'}});
      }
    })());
    return;
  }

  // other requests: cache-first then network
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const networkResponse = await fetch(req);
      if (networkResponse && networkResponse.status === 200) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, networkResponse.clone()).catch(e => log('runtime cache put failed', req.url, e));
      }
      return networkResponse;
    } catch (err) {
      log('fetch failed and no cache', req.url, err);
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
      return new Response('offline', { status: 503, statusText: 'Service Unavailable' });
    }
  })());
});

self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    log('Received SKIP_WAITING');
    self.skipWaiting();
  }
});
SW
