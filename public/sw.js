// Service Worker für Push-Benachrichtigungen (z. B. die Erinnerung 3 Monate vor einer Prüfung).
// Er cached nichts; die Seite lädt wie bisher immer frisch.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Amelies Zeug", {
      body: data.body || "",
      tag: data.tag,
      data: { url: data.url || "/studium" },
      icon: "/icons/amelie-icon-192.png",
      badge: "/icons/amelie-icon-192.png",
      lang: "de",
    }),
  );
});

// Tapping the notification opens the page, reusing an open window of the app if there is one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/studium", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.focus().then((w) => (w && "navigate" in w ? w.navigate(url) : w));
      return self.clients.openWindow(url);
    }),
  );
});
