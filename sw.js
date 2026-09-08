// ============================================
// Takdaro Web Push Service Worker
// فایل: /sw.js
// ============================================

// ============================================
// دریافت Push Notification
// ============================================

self.addEventListener(
  "push",
  (event) => {
    let data = {};

    try {
      if (event.data) {
        data = event.data.json();
      }
    } catch (_) {
      try {
        data = {
          title: "تک دارو",
          body: event.data
            ? event.data.text()
            : ""
        };
      } catch (__) {
        data = {
          title: "تک دارو",
          body: ""
        };
      }
    }

    const title =
      data.title || "تک دارو";

    const body =
      data.body || "";

    let targetUrl =
      data.url || "/";

    try {
      targetUrl =
        new URL(
          targetUrl,
          self.location.origin
        ).href;
    } catch (_) {
      targetUrl =
        self.location.origin + "/";
    }

    const options = {
      body,

      icon:
        data.icon ||
        "/assets/images/logo.png",

      badge:
        data.badge ||
        "/assets/images/logo.png",

      data: {
        url: targetUrl,

        ...(data.data || {})
      },

      tag:
        data.tag ||
        "takdaro-notification",

      renotify:
        data.renotify !== false,

      requireInteraction:
        data.requireInteraction === true
    };

    event.waitUntil(
      self.registration.showNotification(
        title,
        options
      )
    );
  }
);

// ============================================
// کلیک روی Notification
// ============================================

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    let targetUrl =
      event.notification?.data?.url ||
      "/";

    try {
      targetUrl =
        new URL(
          targetUrl,
          self.location.origin
        ).href;
    } catch (_) {
      targetUrl =
        self.location.origin + "/";
    }

    event.waitUntil(
      clients
        .matchAll({
          type: "window",
          includeUncontrolled: true
        })
        .then((clientList) => {
          // ------------------------------------
          // اگر همان URL باز است
          // ------------------------------------

          for (const client of clientList) {
            if (
              client.url === targetUrl &&
              "focus" in client
            ) {
              return client.focus();
            }
          }

          // ------------------------------------
          // اگر صفحه سایت باز است،
          // همان را Navigate کن
          // ------------------------------------

          for (const client of clientList) {
            if (
              client.url.startsWith(
                self.location.origin
              ) &&
              "navigate" in client
            ) {
              return client
                .navigate(targetUrl)
                .then(() => client.focus());
            }
          }

          // ------------------------------------
          // در غیر این صورت پنجره جدید
          // ------------------------------------

          if (clients.openWindow) {
            return clients.openWindow(
              targetUrl
            );
          }

          return null;
        })
    );
  }
);

// ============================================
// نصب Service Worker
// ============================================

self.addEventListener(
  "install",
  () => {
    self.skipWaiting();
  }
);

// ============================================
// فعال‌سازی
// ============================================

self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      clients.claim()
    );
  }
);