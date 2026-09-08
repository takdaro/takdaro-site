(function () {
  "use strict";

  // ============================================
  // Takdaro Web Push
  // ============================================

  const VAPID_PUBLIC_KEY =
    "BD6jfJKFfeZJs42Si5sIErSxzxt7n_dy0GlH4eM7YHtjOAM0hDWonJArCNv38wxFrG8JchIis6iJBbpe5Eil54Q";

  const SERVICE_WORKER_URL = "/sw.js";

  const SUBSCRIBE_URL = "/api/account/push/subscribe";

  const UNSUBSCRIBE_URL = "/api/account/push/unsubscribe";

  // ============================================
  // بررسی پشتیبانی
  // ============================================

  function isSupported() {
    return (
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      window.isSecureContext === true
    );
  }

  // ============================================
  // تبدیل Base64URL به Uint8Array
  // ============================================

  function urlBase64ToUint8Array(base64String) {
    const value = String(base64String || "").trim();

    const padding = "=".repeat(
      (4 - (value.length % 4)) % 4
    );

    const base64 = (value + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);

    const outputArray = new Uint8Array(
      rawData.length
    );

    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  // ============================================
  // ثبت Service Worker
  // ============================================

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      throw new Error(
        "مرورگر شما از Service Worker پشتیبانی نمی‌کند."
      );
    }

    const registration =
      await navigator.serviceWorker.register(
        SERVICE_WORKER_URL,
        {
          scope: "/",
          updateViaCache: "none"
        }
      );

    await navigator.serviceWorker.ready;

    return registration;
  }

  // ============================================
  // دریافت Subscription
  // ============================================

  async function getSubscription(registration) {
    if (!registration?.pushManager) {
      return null;
    }

    return registration.pushManager.getSubscription();
  }

  // ============================================
  // ذخیره Subscription در سرور
  // ============================================

  async function saveSubscription(subscription) {
    if (!subscription) {
      throw new Error(
        "Push Subscription ایجاد نشد."
      );
    }

    const response = await fetch(
      SUBSCRIBE_URL,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        credentials: "same-origin",

        body: JSON.stringify({
          subscription:
            subscription.toJSON()
        })
      }
    );

    let data = null;

    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok || !data?.success) {
      throw new Error(
        data?.error ||
          "ذخیره اطلاعات اعلان مرورگر ناموفق بود."
      );
    }

    return data;
  }

  // ============================================
  // فعال‌سازی Web Push
  // IMPORTANT:
  // این تابع باید مستقیماً از کلیک کاربر اجرا شود.
  // ============================================

  async function enable() {
    if (!isSupported()) {
      throw new Error(
        "Web Push در این مرورگر یا محیط فعلی پشتیبانی نمی‌شود."
      );
    }

    if (!VAPID_PUBLIC_KEY) {
      throw new Error(
        "کلید عمومی VAPID تنظیم نشده است."
      );
    }

    // Permission باید فقط در پاسخ به تعامل کاربر درخواست شود.
    let permission;

    try {
      permission =
        await Notification.requestPermission();
    } catch (error) {
      throw new Error(
        "درخواست اجازه اعلان توسط مرورگر انجام نشد."
      );
    }

    if (permission !== "granted") {
      if (permission === "denied") {
        throw new Error(
          "اعلان‌ها توسط کاربر یا مرورگر مسدود شده است."
        );
      }

      throw new Error(
        "اجازه ارسال اعلان داده نشد."
      );
    }

    const registration =
      await registerServiceWorker();

    let subscription =
      await getSubscription(
        registration
      );

    if (!subscription) {
      subscription =
        await registration.pushManager.subscribe(
          {
            userVisibleOnly: true,

            applicationServerKey:
              urlBase64ToUint8Array(
                VAPID_PUBLIC_KEY
              )
          }
        );
    }

    await saveSubscription(subscription);

    return subscription;
  }

  // ============================================
  // غیرفعال‌سازی Web Push
  // ============================================

  async function disable() {
    if (!("serviceWorker" in navigator)) {
      return true;
    }

    const registration =
      await navigator.serviceWorker.ready;

    const subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      return true;
    }

    const endpoint =
      subscription.endpoint;

    const response = await fetch(
      UNSUBSCRIBE_URL,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        credentials: "same-origin",

        body: JSON.stringify({
          endpoint
        })
      }
    );

    let data = null;

    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok || !data?.success) {
      throw new Error(
        data?.error ||
          "خطا در غیرفعال‌سازی اعلان‌های مرورگر."
      );
    }

    const unsubscribed =
      await subscription.unsubscribe();

    if (!unsubscribed) {
      throw new Error(
        "لغو Subscription اعلان مرورگر ناموفق بود."
      );
    }

    return true;
  }

  // ============================================
  // بررسی فعال بودن Web Push
  // ============================================

  async function isEnabled() {
    if (!isSupported()) {
      return false;
    }

    try {
      const registration =
        await navigator.serviceWorker.ready;

      const subscription =
        await registration.pushManager.getSubscription();

      return !!subscription;
    } catch (_) {
      return false;
    }
  }

  // ============================================
  // دریافت Permission
  // ============================================

  function getPermission() {
    if (!("Notification" in window)) {
      return "unsupported";
    }

    return Notification.permission;
  }

  // ============================================
  // تشخیص iOS / iPadOS
  // ============================================

  function isIOS() {
    const userAgent =
      window.navigator.userAgent ||
      "";

    const platform =
      window.navigator.platform ||
      "";

    const maxTouchPoints =
      Number(
        window.navigator.maxTouchPoints || 0
      );

    return (
      /iPhone|iPad|iPod/i.test(
        userAgent
      ) ||
      (
        platform === "MacIntel" &&
        maxTouchPoints > 1
      )
    );
  }

  // ============================================
  // بررسی Web App نصب‌شده روی Home Screen
  // ============================================

  function isStandalone() {
    return (
      window.matchMedia &&
      window.matchMedia(
        "(display-mode: standalone)"
      ).matches
    ) || window.navigator.standalone === true;
  }

  // ============================================
  // API عمومی
  // ============================================

  window.TakdaroWebPush = {
    enable,
    disable,
    isEnabled,
    getPermission,
    isSupported,
    isIOS,
    isStandalone
  };
})();