const CACHE = 'filefit-static-v1';
const MAX_ENTRIES = 220;
const MAX_BYTES = 64 * 1024 * 1024;
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/favicon.svg', '/manifest.webmanifest']))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('filefit-static-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('message', event => {
  if (event.data?.type === 'CLEAR_FILEFIT_CACHE') event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('filefit-static-')).map(key => caches.delete(key)))).then(() => event.ports[0]?.postMessage({ cleared: true })));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search || request.headers.has('range')) return;
  const eligible = request.mode === 'navigate' || /^\/(assets|engines|ocr|fonts)\//.test(url.pathname) || ['/', '/favicon.svg', '/manifest.webmanifest'].includes(url.pathname);
  if (!eligible) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (request.mode !== 'navigate') { const hit = await cache.match(request); if (hit) return hit; }
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic' && Number(response.headers.get('content-length') || MAX_BYTES + 1) <= MAX_BYTES) {
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) await cache.delete(key);
      }
      return response;
    } catch (error) { const hit = await cache.match(request.mode === 'navigate' ? '/' : request); if (hit) return hit; throw error; }
  })());
});
