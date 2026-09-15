// ========================================================
// SENTINEL'S — Service Worker Notifications Handler
// ========================================================

// Gestionnaire du clic sur la notification native
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/app/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Recherche d'une fenêtre déjà ouverte pour la focaliser
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // Si aucune fenêtre ouverte, ouverture d'un nouvel onglet
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Écoute d'événements push du serveur
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || "SENTINEL'S — Notification";
  const options = {
    body: data.body || "Nouveau message ou alerte de cours reçu.",
    icon: '/icon-192.png',
    badge: '/icon-64.png',
    tag: data.tag || 'sentinels-notification',
    renotify: true,
    data: {
      url: data.url || '/app/dashboard',
      timestamp: Date.now(),
    },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
