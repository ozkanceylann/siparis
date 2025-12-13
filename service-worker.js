// =======================================================
// 🚀 SIPARIS – FINAL SERVICE WORKER
// Auto update + auto reload + safe cache
// =======================================================

// 🔥 Her deploy'da cache otomatik kırılır
const CACHE = "siparis-cache-" + Date.now();

// Cache'lencek STATİK dosyalar
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/api.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// -------------------------------------------------------
// INSTALL → beklemeden aktif ol
// -------------------------------------------------------
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

// -------------------------------------------------------
// ACTIVATE → eski cache’leri sil + sayfaları ele geçir
// -------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );

  // 🔔 Açık sayfalara "yeni deploy" mesajı gönder
  self.clients.matchAll({ type: "window" }).then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: "SW_UPDATED" });
    });
  });
});

// -------------------------------------------------------
// FETCH STRATEGY
// -------------------------------------------------------
self.addEventListener("fetch", (event) => {

  const req = event.request;

  // ❌ POST / PUT / DELETE → ASLA cache'e girmez
  if (req.method !== "GET") {
    event.respondWith(fetch(req));
    return;
  }

  // 🌐 HTML sayfalar → HER ZAMAN network
  if (req.mode === "navigate") {
    event.respondWith(fetch(req));
    return;
  }

  // 📦 Diğer GET istekler → network first + cache fallback
  event.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
