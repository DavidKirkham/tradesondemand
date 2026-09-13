const CACHE = "tod-shell-v2";
const SHELL = ["/", "/book", "/services", "/contractor", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      return cached || caches.match("/offline.html");
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "New TOD job on your plate", body: "Open the contractor app.", url: "/contractor" };
  try {
    const parsed = event.data ? event.data.json() : null;
    if (parsed && typeof parsed === "object") {
      payload = {
        title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : payload.title,
        body: typeof parsed.body === "string" && parsed.body.trim() ? parsed.body : payload.body,
        url: typeof parsed.url === "string" && parsed.url.startsWith("/contractor") ? parsed.url : payload.url,
      };
    }
  } catch {
    const text = event.data && typeof event.data.text === "function" ? event.data.text() : "";
    if (text) payload.body = text;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { url: payload.url },
      icon: "/icon.svg",
      badge: "/icon.svg",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.url;
  const path = typeof raw === "string" && raw.startsWith("/contractor") ? raw : "/contractor";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        const pathname = new URL(client.url).pathname;
        if (pathname.startsWith("/contractor") && "focus" in client) {
          if ("navigate" in client) {
            return client.navigate(path).then((next) => (next && "focus" in next ? next.focus() : client.focus()));
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(path);
    }),
  );
});
