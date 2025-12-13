// =======================================================
// 🔁 AUTO UPDATE SERVICE WORKER
// =======================================================

const CACHE = "siparis-cache-v1"; // versiyon önemli değil artık

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
// INSTALL → cache hazırla ama BEKLEME
// -------------------------------------------------------
self.addEventListener("install", (e) => {
  self.skipWaiting(); // 🔥 yeni SW anında aktif
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
});

// -------------------------------------------------------
// ACTIVATE → eski cache’leri SİL
// -------------------------------------------------------
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim()) // 🔥 tüm tab’leri ele geçir
  );
});

// -------------------------------------------------------
// FETCH → Network first (her zaman GITHUB)
// -------------------------------------------------------
self.addEventListener("fetch", (e) => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
