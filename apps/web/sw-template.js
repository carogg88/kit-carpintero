/* Service worker de Calibre Studio. El build completa la versión y la lista de archivos. */
/* global self, caches, fetch, URL */
const CACHE = 'kit-__VERSION__';
const FILES = [/* __FILES__ */];
const FONTS = 'kit-fuentes';
const HELP = 'kit-ayuda';

self.addEventListener('install', (event) => {
  // Todo o nada: si falta un archivo, la versión vieja sigue andando.
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS && k !== HELP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Las fuentes de Google y las capturas de la ayuda (que no van en el paquete): la copia guardada al toque y se
  // renueva por detrás.
  const help = url.origin === self.location.origin && url.pathname.includes('/ayuda/');
  if (help || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(help ? HELP : FONTS).then(async (c) => {
        const hit = await c.match(req);
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok || res.type === 'opaque') c.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit ?? fresh;
      }),
    );
    return;
  }
  if (url.origin !== self.location.origin) return;
  // La página: primero la red, para tomar la versión nueva; sin conexión, la guardada.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Solo la app: la página de prueba del motor no pisa la copia guardada.
          if (res.ok && !url.pathname.endsWith('.html')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./', copy));
          }
          return res;
        })
        .catch(() => caches.match('./', { ignoreSearch: true })),
    );
    return;
  }
  // Lo demás tiene el hash en el nombre: si está guardado, no cambia.
  event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
});
