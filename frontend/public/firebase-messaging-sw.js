// Firebase Cloud Messaging Service Worker
// Place this file in /public so Vite serves it at the root path.
// Handles background push notifications when the browser tab is closed.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// The config here must match your src/firebase.ts — the SW cannot read .env files.
// These values are safe to be public (they identify the project, not grant access).
firebase.initializeApp({
  apiKey:            self.__FIREBASE_CONFIG?.apiKey            ?? '',
  authDomain:        self.__FIREBASE_CONFIG?.authDomain        ?? '',
  projectId:         self.__FIREBASE_CONFIG?.projectId         ?? '',
  storageBucket:     self.__FIREBASE_CONFIG?.storageBucket     ?? '',
  messagingSenderId: self.__FIREBASE_CONFIG?.messagingSenderId ?? '',
  appId:             self.__FIREBASE_CONFIG?.appId             ?? '',
});

const messaging = firebase.messaging();

// Background message handler — displays a native OS notification
messaging.onBackgroundMessage((payload) => {
  console.log('[Service Worker] Background message received:', payload);

  const notificationTitle = payload.notification?.title ?? 'Ernad MES Alert';
  const notificationOptions = {
    body:  payload.notification?.body ?? 'A production event occurred.',
    icon:  '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data:  payload.data,
    vibrate: [200, 100, 200],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click — open/focus the app window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) return client.focus();
      }
      return clients.openWindow('/');
    }),
  );
});
