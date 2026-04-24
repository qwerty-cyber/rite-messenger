// Service Worker для rite
const CACHE_NAME = 'rite-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.svg'
];

// Установка: кешируем статические файлы
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Кеширую статические файлы');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Активируем новый SW сразу
  self.skipWaiting();
});

// Активация: удаляем старые кеши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Стратегия: Network First с fallback на кеш
self.addEventListener('fetch', (event) => {
  // Не кешируем запросы к Firebase API
  if (event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('identitytoolkit.googleapis.com') ||
      event.request.url.includes('googleapis.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Кешируем успешные ответы
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Если нет сети — отдаём из кеша
        return caches.match(event.request);
      })
  );
});