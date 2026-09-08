// ============================================
// Takdaro Notification UI
// مدیریت Modal و تنظیمات Web Push
// ============================================

const NotificationUI = {
  // ==========================================
  // وضعیت داخلی
  // ==========================================

  state: {
    initializing: false,
    enabling: false
  },

  // ==========================================
  // تنظیمات
  // ==========================================

  settings: {
    // مدت زمان «بعداً»
    // 24 ساعت
    postponeDuration: 24 * 60 * 60 * 1000,

    // کلید ذخیره زمان انتخاب «بعداً»
    postponeStorageKey:
      "takdaro_webpush_postponed_at",

    // شناسه کاربر برای جلوگیری از
    // تداخل تنظیمات کاربران مختلف
    postponeUserStorageKey:
      "takdaro_webpush_postponed_user_id"
  },

  // ==========================================
  // بررسی ورود کاربر
  // ==========================================

  async isAuthenticated() {
    try {
      const response = await fetch(
        "/api/auth/me",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store"
        }
      );

      if (!response.ok) {
        return false;
      }

      const data =
        await response.json().catch(
          () => null
        );

      return !!(
        data &&
        data.success === true &&
        data.user &&
        data.user.id
      );

    } catch (error) {
      console.error(
        "Notification authentication check error:",
        error
      );

      return false;
    }
  },

  // ==========================================
  // دریافت کاربر جاری
  // ==========================================

  async getCurrentUser() {
    try {
      const response = await fetch(
        "/api/auth/me",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store"
        }
      );

      if (!response.ok) {
        return null;
      }

      const data =
        await response.json().catch(
          () => null
        );

      if (
        !data ||
        data.success !== true ||
        !data.user ||
        !data.user.id
      ) {
        return null;
      }

      return data.user;

    } catch (error) {
      console.error(
        "Notification get current user error:",
        error
      );

      return null;
    }
  },

  // ==========================================
  // بررسی Login با تلاش مجدد
  // ==========================================

  async waitForAuthentication(
    attempts = 5,
    delay = 700
  ) {
    for (
      let attempt = 1;
      attempt <= attempts;
      attempt++
    ) {
      const authenticated =
        await this.isAuthenticated();

      if (authenticated) {
        return true;
      }

      if (attempt < attempts) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              delay
            )
        );
      }
    }

    return false;
  },

  // ==========================================
  // دریافت Modal
  // ==========================================

  getModal() {
    return document.getElementById(
      "notificationModal"
    );
  },

  // ==========================================
  // بررسی پشتیبانی مرورگر
  // ==========================================

  isSupported() {
    if (
      window.TakdaroWebPush &&
      typeof window.TakdaroWebPush.isSupported ===
        "function"
    ) {
      try {
        return !!window.TakdaroWebPush.isSupported();
      } catch (_) {}
    }

    return (
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  },

  // ==========================================
  // Permission
  // ==========================================

  getPermission() {
    if (
      window.TakdaroWebPush &&
      typeof window.TakdaroWebPush.getPermission ===
        "function"
    ) {
      try {
        return window.TakdaroWebPush.getPermission();
      } catch (_) {}
    }

    if ("Notification" in window) {
      return Notification.permission;
    }

    return "unsupported";
  },

  // ==========================================
  // بررسی iOS
  // ==========================================

  isIOS() {
    if (
      window.TakdaroWebPush &&
      typeof window.TakdaroWebPush.isIOS ===
        "function"
    ) {
      try {
        return !!window.TakdaroWebPush.isIOS();
      } catch (_) {}
    }

    const userAgent =
      navigator.userAgent || "";

    return (
      /iPad|iPhone|iPod/.test(
        userAgent
      ) ||
      (
        /Macintosh/.test(
          userAgent
        ) &&
        "ontouchend" in document
      )
    );
  },

  // ==========================================
  // بررسی Standalone
  // ==========================================

  isStandalone() {
    if (
      window.TakdaroWebPush &&
      typeof window.TakdaroWebPush.isStandalone ===
        "function"
    ) {
      try {
        return !!window.TakdaroWebPush.isStandalone();
      } catch (_) {}
    }

    return (
      (
        window.matchMedia &&
        window.matchMedia(
          "(display-mode: standalone)"
        ).matches
      ) ||
      !!navigator.standalone
    );
  },

  // ==========================================
  // بررسی وضعیت «بعداً»
  //
  // کاربر بعداً را انتخاب کرده؟
  // اگر کمتر از 24 ساعت گذشته باشد:
  // Modal نمایش داده نمی‌شود.
  // ==========================================

  isPostponed(userId) {
    try {
      const storedUserId =
        localStorage.getItem(
          this.settings
            .postponeUserStorageKey
        );

      const storedAt =
        localStorage.getItem(
          this.settings
            .postponeStorageKey
        );

      if (
        !storedUserId ||
        !storedAt
      ) {
        return false;
      }

      if (
        String(storedUserId) !==
        String(userId)
      ) {
        return false;
      }

      const timestamp =
        Number(storedAt);

      if (
        !Number.isFinite(timestamp)
      ) {
        return false;
      }

      const elapsed =
        Date.now() - timestamp;

      if (
        elapsed <
        this.settings
          .postponeDuration
      ) {
        return true;
      }

      this.clearPostponed();

      return false;

    } catch (error) {
      console.error(
        "Notification postpone check error:",
        error
      );

      return false;
    }
  },

  // ==========================================
  // ذخیره «بعداً»
  // ==========================================

  postpone(userId) {
    try {
      localStorage.setItem(
        this.settings
          .postponeStorageKey,
        String(Date.now())
      );

      localStorage.setItem(
        this.settings
          .postponeUserStorageKey,
        String(userId)
      );

    } catch (error) {
      console.error(
        "Notification postpone save error:",
        error
      );
    }
  },

  // ==========================================
  // پاک کردن وضعیت «بعداً»
  // ==========================================

  clearPostponed() {
    try {
      localStorage.removeItem(
        this.settings
          .postponeStorageKey
      );

      localStorage.removeItem(
        this.settings
          .postponeUserStorageKey
      );

    } catch (error) {
      console.error(
        "Notification postpone clear error:",
        error
      );
    }
  },

  // ==========================================
  // نمایش Modal
  // ==========================================

  showModal() {
    const modal =
      this.getModal();

    if (!modal) {
      console.warn(
        "notificationModal پیدا نشد."
      );

      return false;
    }

    if (!this.isSupported()) {
      console.warn(
        "Web Push در این مرورگر پشتیبانی نمی‌شود."
      );

      return false;
    }

    const permission =
      this.getPermission();

    const title =
      modal.querySelector(
        ".notification-modal-title"
      );

    const text =
      modal.querySelector(
        ".notification-modal-text"
      );

    const acceptBtn =
      document.getElementById(
        "notificationAcceptBtn"
      );

    const skipBtn =
      document.getElementById(
        "notificationSkipBtn"
      );

    // ========================================
    // iOS قبل از نصب روی Home Screen
    // ========================================

    if (
      this.isIOS() &&
      !this.isStandalone()
    ) {
      if (title) {
        title.textContent =
          "🔔 فعال‌سازی اعلان‌ها";
      }

      if (text) {
        text.innerHTML = `
          برای دریافت اعلان‌های تک‌دارو در
          آیفون یا آیپد، ابتدا سایت را به
          <strong>Home Screen</strong>
          اضافه کنید.
          <br><br>
          سپس سایت را از صفحه اصلی باز کنید
          و اعلان‌ها را فعال کنید.
        `;
      }

      if (acceptBtn) {
        acceptBtn.disabled = false;

        acceptBtn.textContent =
          "📱 راهنمای فعال‌سازی";

        acceptBtn.onclick = () => {
          this.showIOSInstallInstructions();
        };
      }

      // «بعداً»
      if (skipBtn) {
        skipBtn.style.display =
          "inline-flex";

        skipBtn.disabled = false;

        skipBtn.onclick = async () => {
          await this.postponeAndClose();
        };
      }

      this.prepareOverlay(modal);

      this.openModal(modal);

      return true;
    }

    // ========================================
    // Permission = denied
    // ========================================

    if (
      permission === "denied"
    ) {
      if (title) {
        title.textContent =
          "⚠️ اعلان‌ها مسدود هستند";
      }

      if (text) {
        text.innerHTML = `
          اعلان‌های تک‌دارو در مرورگر شما
          مسدود شده‌اند.
          <br><br>
          برای فعال‌سازی، اجازه Notifications
          سایت تک‌دارو را از تنظیمات مرورگر
          روی <strong>Allow</strong> قرار دهید.
          <br><br>
          می‌توانید فعلاً گزینه «بعداً» را بزنید.
        `;
      }

      if (acceptBtn) {
        acceptBtn.disabled = false;

        acceptBtn.textContent =
          "⚙️ راهنمای فعال‌سازی";

        acceptBtn.onclick = () => {
          this.showPermissionHelp();
        };
      }

      if (skipBtn) {
        skipBtn.style.display =
          "inline-flex";

        skipBtn.disabled = false;

        skipBtn.onclick = async () => {
          await this.postponeAndClose();
        };
      }

      this.prepareOverlay(modal);

      this.openModal(modal);

      return true;
    }

    // ========================================
    // حالت عادی
    // ========================================

    if (title) {
      title.textContent =
        "🔔 فعال‌سازی اعلان‌ها";
    }

    if (text) {
      text.innerHTML = `
        برای دریافت اطلاع‌رسانی درباره سفارش‌ها،
        تغییرات وضعیت و اطلاعیه‌های مهم،
        اعلان‌های تک‌دارو را فعال کنید.
        <br><br>
        می‌توانید الان فعال کنید یا گزینه
        «بعداً» را انتخاب کنید.
      `;
    }

    // ========================================
    // دکمه فعال‌سازی
    // ========================================

    if (acceptBtn) {
      acceptBtn.disabled = false;

      acceptBtn.textContent =
        "✅ فعال‌سازی اعلان‌ها";

      acceptBtn.onclick = async () => {
        await this.enableFromUserGesture(
          acceptBtn,
          modal
        );
      };
    }

    // ========================================
    // دکمه بعداً
    // ========================================

    if (skipBtn) {
      skipBtn.style.display =
        "inline-flex";

      skipBtn.disabled = false;

      skipBtn.textContent =
        "⏭️ بعداً";

      skipBtn.onclick = async () => {
        await this.postponeAndClose();
      };
    }

    // ========================================
    // Overlay
    //
    // کلیک روی Overlay می‌تواند Modal
    // را ببندد و مانند «بعداً» عمل کند.
    // ========================================

    this.prepareOverlay(modal);

    // ========================================
    // نمایش Modal
    // ========================================

    this.openModal(modal);

    return true;
  },

  // ==========================================
  // تنظیم رفتار Overlay
  // ==========================================

  prepareOverlay(modal) {
    if (!modal) {
      return;
    }

    const overlay =
      modal.querySelector(
        ".notification-modal-overlay"
      );

    if (!overlay) {
      return;
    }

    overlay.onclick = async (
      event
    ) => {
      if (
        event.target ===
        overlay
      ) {
        await this.postponeAndClose();
      }
    };
  },

  // ==========================================
  // بستن با «بعداً»
  // ==========================================

  async postponeAndClose() {
    try {
      const user =
        await this.getCurrentUser();

      if (user?.id) {
        this.postpone(user.id);
      }

      const modal =
        this.getModal();

      this.closeModal(modal);

      this.showToast(
        "ℹ️ مشکلی نیست؛ می‌توانید اعلان‌ها را بعداً از حساب کاربری فعال کنید.",
        "info"
      );

    } catch (error) {
      console.error(
        "Postpone notification error:",
        error
      );

      const modal =
        this.getModal();

      this.closeModal(modal);
    }
  },

  // ==========================================
  // باز کردن Modal
  // ==========================================

  openModal(modal) {
    if (!modal) {
      return;
    }

    modal.style.display =
      "flex";

    document.documentElement
      .style
      .overflow = "hidden";

    document.body.style.overflow =
      "hidden";
  },

  // ==========================================
  // بستن Modal
  // ==========================================

  closeModal(modal) {
    if (!modal) {
      return;
    }

    modal.style.display =
      "none";

    document.documentElement
      .style
      .overflow = "";

    document.body.style.overflow =
      "";
  },

  // ==========================================
  // فعال‌سازی از کلیک واقعی کاربر
  // ==========================================

  async enableFromUserGesture(
    button,
    modal
  ) {
    if (this.state.enabling) {
      return;
    }

    if (
      !window.TakdaroWebPush ||
      typeof window.TakdaroWebPush.enable !==
        "function"
    ) {
      this.showToast(
        "❌ سیستم اعلان سایت بارگذاری نشده است.",
        "error"
      );

      return;
    }

    // ========================================
    // بررسی Login
    // ========================================

    const authenticated =
      await this.isAuthenticated();

    if (!authenticated) {
      this.showToast(
        "برای فعال‌سازی اعلان‌ها باید وارد حساب کاربری شوید.",
        "error"
      );

      return;
    }

    this.state.enabling =
      true;

    const originalText =
      button?.textContent ||
      "✅ فعال‌سازی اعلان‌ها";

    try {
      if (button) {
        button.disabled =
          true;

        button.textContent =
          "⏳ در حال فعال‌سازی...";
      }

      const subscription =
        await window.TakdaroWebPush.enable();

      if (!subscription) {
        throw new Error(
          "Subscription ایجاد نشد."
        );
      }

      // Push با موفقیت فعال شد،
      // بنابراین حالت «بعداً» نیز پاک شود.
      this.clearPostponed();

      if (modal) {
        this.closeModal(modal);
      }

      this.showToast(
        "✅ اعلان‌های تک‌دارو با موفقیت فعال شدند.",
        "success"
      );

      await this.updateAccountStatus();

    } catch (error) {
      console.error(
        "Web Push enable error:",
        error
      );

      const permission =
        this.getPermission();

      if (
        permission === "denied"
      ) {
        this.showPermissionHelp();
      } else {
        this.showToast(
          "❌ " +
            String(
              error?.message ||
              "فعال‌سازی اعلان‌ها انجام نشد."
            ),
          "error"
        );
      }

      if (button) {
        button.disabled =
          false;

        button.textContent =
          originalText;
      }

    } finally {
      this.state.enabling =
        false;
    }
  },

  // ==========================================
  // راهنمای iOS
  // ==========================================

  showIOSInstallInstructions() {
    this.showToast(
      "در آیفون، گزینه Share را بزنید و Add to Home Screen را انتخاب کنید. سپس سایت تک‌دارو را از صفحه اصلی باز کنید.",
      "info"
    );
  },

  // ==========================================
  // راهنمای Permission
  // ==========================================

  showPermissionHelp() {
    this.showToast(
      "⚙️ اعلان‌های تک‌دارو در مرورگر مسدود هستند. از تنظیمات مجوزهای سایت، Notifications را روی Allow قرار دهید.",
      "info"
    );
  },

  // ==========================================
  // وضعیت Web Push
  // ==========================================

  async checkStatus() {
    if (!window.TakdaroWebPush) {
      return {
        supported: false,
        permission: "unsupported",
        enabled: false
      };
    }

    const supported =
      this.isSupported();

    const permission =
      this.getPermission();

    let enabled = false;

    if (
      supported &&
      typeof window.TakdaroWebPush.isEnabled ===
        "function"
    ) {
      try {
        enabled =
          await window.TakdaroWebPush.isEnabled();

      } catch (error) {
        console.error(
          "Web Push isEnabled error:",
          error
        );

        enabled =
          false;
      }
    }

    return {
      supported,
      permission,
      enabled
    };
  },

  // ==========================================
  // بررسی خودکار
  //
  // Login نیست
  // → Modal نمی‌آید
  //
  // Login + Push فعال
  // → Modal نمی‌آید
  //
  // Login + Push غیرفعال
  // → Modal می‌آید
  //
  // «بعداً»
  // → تا 24 ساعت Modal دوباره نمی‌آید
  // ==========================================

  async checkAndEnable() {
    if (this.state.initializing) {
      return;
    }

    this.state.initializing =
      true;

    try {
      // ========================================
      // Modal باید در DOM باشد
      // ========================================

      const modal =
        this.getModal();

      if (!modal) {
        console.warn(
          "🔔 notificationModal هنوز در DOM نیست."
        );

        return;
      }

      // ========================================
      // فقط کاربر Login شده
      // ========================================

      const user =
        await this.getCurrentUserWithRetry();

      if (!user) {
        console.log(
          "🔕 Web Push: کاربر وارد نشده است."
        );

        return;
      }

      // ========================================
      // بررسی پشتیبانی
      // ========================================

      if (!this.isSupported()) {
        console.log(
          "Web Push در این مرورگر پشتیبانی نمی‌شود."
        );

        return;
      }

      // ========================================
      // بررسی وضعیت Push
      // ========================================

      const status =
        await this.checkStatus();

      console.log(
        "🔔 Takdaro Web Push status:",
        status
      );

      // ========================================
      // Push فعال است
      // ========================================

      if (
        status.permission ===
          "granted" &&
        status.enabled ===
          true
      ) {
        console.log(
          "✅ Web Push فعال است."
        );

        this.clearPostponed();

        await this.updateAccountStatus();

        return;
      }

      // ========================================
      // بررسی «بعداً»
      // ========================================

      if (
        this.isPostponed(
          user.id
        )
      ) {
        console.log(
          "⏭️ کاربر فعال‌سازی اعلان را به بعد موکول کرده است."
        );

        return;
      }

      // ========================================
      // نمایش Modal
      // ========================================

      console.log(
        "⚠️ Web Push فعال نیست؛ Modal نمایش داده می‌شود."
      );

      this.showModal();

    } catch (error) {
      console.error(
        "❌ Notification check error:",
        error
      );

    } finally {
      this.state.initializing =
        false;
    }
  },

  // ==========================================
  // بررسی کاربر با چند تلاش
  // ==========================================

  async getCurrentUserWithRetry(
    attempts = 5,
    delay = 700
  ) {
    for (
      let attempt = 1;
      attempt <= attempts;
      attempt++
    ) {
      const user =
        await this.getCurrentUser();

      if (user) {
        return user;
      }

      if (
        attempt < attempts
      ) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              delay
            )
        );
      }
    }

    return null;
  },

  // ==========================================
  // اجرای مطمئن اولیه
  // ==========================================

  async initialize() {
    // تلاش اول
    await this.checkAndEnable();

    // تلاش دوم
    setTimeout(() => {
      this.checkAndEnable();
    }, 1000);

    // تلاش سوم
    setTimeout(() => {
      this.checkAndEnable();
    }, 2500);

    // تلاش چهارم
    setTimeout(() => {
      this.checkAndEnable();
    }, 5000);
  },

  // ==========================================
  // Toast
  // ==========================================

  showToast(
    message,
    type = "info"
  ) {
    const colors = {
      success: "#28a745",
      error: "#dc3545",
      info: "#17a2b8"
    };

    const toast =
      document.createElement("div");

    toast.style.cssText = `
      position: fixed;
      bottom: 30px;
      right: 30px;
      background: ${colors[type] || "#333"};
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-size: 15px;
      max-width: 430px;
      z-index: 999999;
      box-shadow: 0 8px 30px rgba(0,0,0,0.2);
      animation: notificationSlideUp 0.4s ease;
      direction: rtl;
      line-height: 1.8;
    `;

    toast.textContent =
      message;

    document.body.appendChild(
      toast
    );

    setTimeout(() => {
      toast.style.opacity =
        "0";

      toast.style.transition =
        "opacity 0.4s ease";

      setTimeout(() => {
        toast.remove();
      }, 400);

    }, 5000);
  },

  // ==========================================
  // Banner
  // ==========================================

  showBanner(message) {
    const oldBanner =
      document.querySelector(
        ".notification-banner"
      );

    if (oldBanner) {
      oldBanner.remove();
    }

    const banner =
      document.createElement("div");

    banner.className =
      "notification-banner";

    banner.innerHTML = `
      <div style="
        background: #fff3cd;
        border: 1px solid #ffc107;
        padding: 14px 20px;
        border-radius: 10px;
        margin: 12px 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
        direction: rtl;
      ">

        <span style="
          font-size: 14px;
          color: #856404;
          line-height: 1.8;
        ">
          ${message}
        </span>

        <button
          type="button"
          aria-label="بستن"
          style="
            background: none;
            border: none;
            font-size: 18px;
            color: #856404;
            cursor: pointer;
          "
        >
          ✕
        </button>

      </div>
    `;

    const closeButton =
      banner.querySelector(
        "button"
      );

    if (closeButton) {
      closeButton.onclick =
        () => banner.remove();
    }

    const main =
      document.querySelector(
        "main"
      );

    if (main) {
      main.prepend(banner);
    } else {
      document.body.prepend(
        banner
      );
    }
  },

  // ==========================================
  // تنظیمات حساب کاربری
  // ==========================================

  async setupAccountSettings() {
    const settingsSection =
      document.querySelector(
        ".settings-section, .account-section"
      );

    if (!settingsSection) {
      return;
    }

    if (
      document.querySelector(
        ".webpush-settings"
      )
    ) {
      return;
    }

    const authenticated =
      await this.waitForAuthentication(
        3,
        500
      );

    if (!authenticated) {
      return;
    }

    const webpushSettings =
      document.createElement("div");

    webpushSettings.className =
      "webpush-settings";

    webpushSettings.innerHTML = `
      <div style="
        background: #f8f9fa;
        padding: 20px;
        border-radius: 12px;
        margin: 15px 0;
        direction: rtl;
      ">

        <h4 style="
          margin-bottom: 10px;
        ">
          🔔 تنظیمات اعلان‌ها
        </h4>

        <div
          id="webpush-status"
          style="
            margin-bottom: 12px;
          "
        >
          <span>
            وضعیت:
          </span>

          <span
            id="webpush-status-text"
            style="
              color:#6c757d;
            "
          >
            در حال بررسی...
          </span>
        </div>

        <button
          id="webpush-toggle-btn"
          type="button"
          class="btn btn-primary"
          style="
            padding: 8px 20px;
          "
        >
          فعال‌سازی اعلان‌ها
        </button>

      </div>
    `;

    settingsSection.appendChild(
      webpushSettings
    );

    await this.updateAccountStatus();

    const button =
      document.getElementById(
        "webpush-toggle-btn"
      );

    if (!button) {
      return;
    }

    button.addEventListener(
      "click",
      async () => {
        try {
          const authenticated =
            await this.isAuthenticated();

          if (!authenticated) {
            this.showToast(
              "برای تغییر تنظیمات اعلان باید وارد حساب کاربری شوید.",
              "error"
            );

            return;
          }

          const enabled =
            await window.TakdaroWebPush.isEnabled();

          if (enabled) {
            await window.TakdaroWebPush.disable();

            this.showToast(
              "✅ اعلان‌ها غیرفعال شدند.",
              "info"
            );

          } else {
            await this.enableFromUserGesture(
              button,
              null
            );
          }

          await this.updateAccountStatus();

        } catch (error) {
          console.error(
            "Account Web Push error:",
            error
          );

          this.showToast(
            "❌ " +
              String(
                error?.message ||
                "عملیات اعلان انجام نشد."
              ),
            "error"
          );
        }
      }
    );
  },

  // ==========================================
  // بروزرسانی وضعیت Account
  // ==========================================

  async updateAccountStatus() {
    const statusText =
      document.getElementById(
        "webpush-status-text"
      );

    const toggleButton =
      document.getElementById(
        "webpush-toggle-btn"
      );

    if (!statusText) {
      return;
    }

    try {
      const status =
        await this.checkStatus();

      if (
        status.enabled &&
        status.permission ===
          "granted"
      ) {
        statusText.textContent =
          "فعال ✅";

        statusText.style.color =
          "#28a745";

        if (toggleButton) {
          toggleButton.textContent =
            "غیرفعال‌سازی اعلان‌ها";
        }

        return;
      }

      if (
        status.permission ===
        "denied"
      ) {
        statusText.textContent =
          "مسدود شده ⚠️";

        statusText.style.color =
          "#dc3545";

        if (toggleButton) {
          toggleButton.textContent =
            "راهنمای فعال‌سازی";
        }

        return;
      }

      statusText.textContent =
        "غیرفعال ❌";

      statusText.style.color =
        "#dc3545";

      if (toggleButton) {
        toggleButton.textContent =
          "فعال‌سازی اعلان‌ها";
      }

    } catch (error) {
      console.error(
        "updateAccountStatus error:",
        error
      );

      statusText.textContent =
        "خطا در بررسی";

      statusText.style.color =
        "#dc3545";
    }
  },

  // ==========================================
  // API عمومی برای تست
  // ==========================================

  async test() {
    return this.checkAndEnable();
  }
};

// ============================================
// API عمومی
// ============================================

window.NotificationUI =
  NotificationUI;

// ============================================
// اجرای خودکار
// ============================================

document.addEventListener(
  "DOMContentLoaded",
  () => {
    NotificationUI.initialize();

    NotificationUI.setupAccountSettings();
  },
  {
    once: true
  }
);