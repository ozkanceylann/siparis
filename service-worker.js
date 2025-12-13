// =======================================================
// 🔁 AUTO UPDATE + AUTO RELOAD SERVICE WORKER (FINAL)
// =======================================================

// 🔥 Cache versiyonu otomatik (deploy sonrası kırılır)
const CACHE = "siparis-cache-" + Date.now();

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
self.addEventListener("install", (e) => {
  self.skipWaiting(); // 🔥 yeni SW anında aktif
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
});

// -------------------------------------------------------
// ACTIVATE → eski cache’leri sil + sayfaları ele geçir
// -------------------------------------------------------
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );

  // 🔔 Sayfalara "yeni deploy" bildir
  self.clients.matchAll({ type: "window" }).then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: "SW_UPDATED" });
    });
  });
});

// -------------------------------------------------------
// FETCH
// - HTML → HER ZAMAN network (eski sayfa sorunu biter)
// - Diğerleri → network first + cache fallback
// -------------------------------------------------------
self.addEventListener("fetch", (e) => {

  // HTML navigasyonlar asla cache’ten gelmesin
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request));
    return;
  }

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
