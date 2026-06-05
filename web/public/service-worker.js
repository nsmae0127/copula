const CACHE_NAME = "copula-static-v6";
const ASSETS = [
  "/manifest.webmanifest",
  "/legal/privacy.html",
  "/legal/terms.html",
  "/legal/support.html",
  "/assets/apple-touch-icon.png",
  "/assets/favicon.png",
  "/assets/logo-192.png",
  "/assets/logo-512.png",
  "/assets/logo-mark-96.png",
  "/assets/copula_bg_logo.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      ),
      self.clients.claim().then(() => {
        return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
          for (const client of clients) {
            try {
              client.navigate(client.url);
            } catch (err) {
              // Ignore navigation failures for inactive clients
            }
          }
        });
      })
    ])
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  const acceptHeader = event.request.headers.get("accept") || "";

  // Never cache HTML or navigation requests in the Service Worker to avoid cache locking
  if (event.request.mode === "navigate" || acceptHeader.includes("text/html") || url.pathname === "/" || url.pathname === "/index.html") {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-First only for specific static files listed in ASSETS
  const isStaticAsset = ASSETS.some(assetPath => url.pathname === assetPath);
  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }

  // Direct network for everything else (Vite JS/CSS bundles, Supabase requests, API)
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: "Copula",
      body: event.data ? event.data.text() : "새 알림이 있습니다."
    };
  }

  const title = payload.title || "Copula";
  const options = {
    body: payload.body || "새 알림이 있습니다.",
    icon: "/assets/logo-192.png",
    badge: "/assets/logo-mark-96.png",
    tag: payload.tag || "copula-notification",
    data: {
      url: payload.url || "/"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((client) => client.url === targetUrl || client.url === self.location.origin + "/");
      if (existing) {
        existing.focus();
        if ("navigate" in existing) {
          return existing.navigate(targetUrl);
        }
        return undefined;
      }
      return clients.openWindow(targetUrl);
    })
  );
});
