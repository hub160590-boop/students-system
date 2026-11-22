// ============================================================
// MINDBOOK Service Worker - FIXED VERSION
// ============================================================

const CACHE_NAME = 'student-system-v2'; // ⬅️ Hinduye version uko ushyira update
const RUNTIME_CACHE = 'student-system-runtime-v2';

// Assets za local zidasanzwe (ntizigomba guhinduka)
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// ============================================================
// INSTALL - Precache app shell
// ============================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precaching app shell');
        // Ushobora gukoresha { cache: 'reload' } kugira ngo ureke cache ya kera
        return cache.addAll(PRECACHE_ASSETS.map(url => new Request(url, { cache: 'reload' })));
      })
      .then(() => {
        // Fata control vuba
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Precache failed:', err);
      })
  );
});

// ============================================================
// ACTIVATE - Siba cache za kera
// ============================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Fata control y'abakoresha bose vuba
        return self.clients.claim();
      })
  );
});

// ============================================================
// FETCH - Strategy itandukanye ku byiciro bitandukanye
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1️⃣ Ntukore kuri requests zitari GET (POST, PUT, DELETE, etc.)
  if (request.method !== 'GET') return;

  // 2️⃣ Ntukore kuri requests za Firebase, Cloudinary, API
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('cloudinary.com') ||
    url.hostname.includes('firestore') ||
    url.pathname.startsWith('/api/')
  ) {
    // Network-only (ntukore cache)
    return;
  }

  // 3️⃣ Ntukore kuri chrome-extension cyangwa schemes zidasanzwe
  if (!url.protocol.startsWith('http')) return;

  // 4️⃣ HTML navigation → Network First (kugira ngo ubone version nshya)
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Bika muri cache copy nshya
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Nta internet → subiza cache
          return caches.match(request).then((cached) => {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 5️⃣ CDN assets (JS, CSS, fonts, images za CDN) → Cache First
  // (ntibihinduka kenshi, bifasha kubaka vuba)
  if (
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdn.jsdelivr.net')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // Bika gusa niba ari response nziza
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // 6️⃣ Byose bindi (images, fonts za local, etc.) → Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => cached); // Niba network yanze, subiza cache

      return cached || fetchPromise;
    })
  );
});

// ============================================================
// MESSAGE - Allows app kuvugana na SW (nka skipWaiting)
// ============================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});
