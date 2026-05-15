/* ViaFinance Pessoal — service worker básico (offline shell + ícones) */
const CACHE = "viafinance-v1";
const PRECACHE = [
  "/favicon.svg",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/icon-maskable-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Apenas GET, mesma origem
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Nunca cachear chamadas de auth, api, server actions, _next/data, RSC
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data") ||
    url.searchParams.has("_rsc") ||
    req.headers.get("RSC") === "1" ||
    req.headers.get("Next-Action")
  ) {
    return;
  }

  // Estratégia: stale-while-revalidate para assets estáticos; network-first para HTML
  const isAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.match(/\.(svg|png|jpg|jpeg|webp|ico|woff2?|ttf|css|js)$/);

  if (isAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // HTML / navegação: network-first com fallback cache
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("/dashboard"))),
    );
  }
});
