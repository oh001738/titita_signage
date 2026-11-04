/* Offline playback only. Never cache CMS pages, sessions, or API JSON. */
const CACHE = 'titita-playback-v1';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch('/display', { cache: 'reload' });
    if (!response.ok) throw new Error('Playback shell unavailable');
    const html = await response.clone().text();
    await cache.put('/display', response);
    const assets = [...html.matchAll(/(?:src|href)="([^"<>]+)"/g)].map(m => m[1].replaceAll('&amp;', '&')).filter(url => url.startsWith('/_next/static/'));
    await cache.addAll([...new Set(['/concert-art.png', ...assets])]);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('titita-playback-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate' && url.pathname === '/display') {
    event.respondWith((async () => {
      try { const response = await fetch(event.request); if (response.ok) (await caches.open(CACHE)).put('/display', response.clone()); return response; }
      catch { return await caches.match('/display') || new Response('看板尚未完成離線準備', {status:503}); }
    })()); return;
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/concert-art.png' || url.pathname.startsWith('/api/media/')) {
    event.respondWith((async () => {
      const cached = await caches.match(event.request); if (cached) return cached;
      const response = await fetch(event.request); if (response.ok) (await caches.open(CACHE)).put(event.request, response.clone()); return response;
    })());
  }
});