const CACHE = 'casa-v2';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'casa-cfg').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Stale-while-revalidate: funciona sin conexión y se actualiza sola
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});

const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

// Recordatorio en segundo plano (Chrome Android con la app instalada)
async function remind() {
  const c = await caches.open('casa-cfg');
  const r = await c.match('./__cfg');
  if (!r) return;
  const cfg = await r.json();
  if (!cfg.notif || new Date().getHours() < cfg.hour || cfg.notified === today()) return;
  const pending = cfg.date === today() ? cfg.pending : cfg.nextCount;
  if (!pending) return;
  cfg.notified = today();
  await c.put('./__cfg', new Response(JSON.stringify(cfg)));
  await self.registration.showNotification('Casa en orden', {
    body: `Tenés ${pending} mini tarea${pending > 1 ? 's' : ''} para hoy. Con ${cfg.budget} minutos alcanza.`,
    icon: 'icon-192.png', badge: 'icon-192.png', tag: 'casa'
  });
}
self.addEventListener('periodicsync', e => { if (e.tag === 'recordatorio') e.waitUntil(remind()); });

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./index.html#hoy')));
});
