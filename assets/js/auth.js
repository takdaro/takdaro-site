const Auth = (() => {
  const endpoints = {
    register: "/api/auth/register",
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    me: "/api/auth/me",
    profile: "/api/auth/profile",
    adminMe: "/api/admin/me"
  };

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      data
    };
  }

  // ==========================================
  // ثبت‌نام
  // ==========================================
  async function register(payload) {
    return request(endpoints.register, {
      method: "POST",
      body: JSON.stringify({
        full_name: String(payload.full_name || "").trim(),
        phone: String(payload.phone || "").trim(),
        email: String(payload.email || "").trim(),
        password: String(payload.password || ""),
        access_code: String(payload.access_code || "")
      })
    });
  }

  // ==========================================
  // ورود
  // ==========================================
  async function login(payload) {
    return request(endpoints.login, {
      method: "POST",
      body: JSON.stringify({
        email: String(payload.email || "").trim(),
        password: String(payload.password || ""),
        access_code: String(payload.access_code || "")
      })
    });
  }

  // ==========================================
  // خروج
  // ==========================================
  async function logout() {
    return request(endpoints.logout, {
      method: "POST"
    });
  }

  // ==========================================
  // دریافت کاربر فعلی
  // ==========================================
  async function getCurrentUser() {
    return request(endpoints.me, {
      method: "GET"
    });
  }

  // ==========================================
  // دریافت مدیر فعلی
  // ==========================================
  async function getAdminUser() {
    return request(endpoints.adminMe, {
      method: "GET"
    });
  }

  // ==========================================
  // دریافت پروفایل
  // ==========================================
  async function getProfile() {
    return request(endpoints.profile, {
      method: "GET"
    });
  }

  // ==========================================
  // بروزرسانی پروفایل
  // ==========================================
  async function updateProfile(payload) {
    const result = await request(endpoints.profile, {
      method: "POST",
      body: JSON.stringify({
        full_name: String(payload.full_name || "").trim(),
        email: String(payload.email || "").trim(),
        phone: String(payload.phone || "").trim(),
        password: String(payload.password || ""),
        password_confirm: String(
          payload.password_confirm || ""
        )
      })
    });

    if (result.ok && result.data?.success === true) {
      return {
        success: true,
        user: result.data.user,
        message: result.data.message
      };
    }

    return {
      success: false,
      error:
        result.data?.error ||
        "خطا در ارتباط با سرور"
    };
  }

  // ==========================================
  // نمایش پیام
  // ==========================================
  function setMessage(
    element,
    message,
    type = "error"
  ) {
    if (!element) return;

    element.textContent = message || "";
    element.style.display = message
      ? "block"
      : "none";

    element.classList.remove(
      "is-error",
      "is-success",
      "is-warning"
    );

    if (message) {
      element.classList.add(
        type === "success"
          ? "is-success"
          : type === "warning"
            ? "is-warning"
            : "is-error"
      );
    }
  }

  // ==========================================
  // انتقال صفحه
  // ==========================================
  function redirectTo(
    url,
    replace = false
  ) {
    if (replace) {
      window.location.replace(url);
      return;
    }

    window.location.href = url;
  }

  // ==========================================
  // دریافت آدرس بازگشت
  // ==========================================
  function getRedirectParam() {
    const params = new URLSearchParams(
      window.location.search
    );

    const redirect =
      params.get("redirect") || "";

    if (!redirect.startsWith("/")) {
      return null;
    }

    return redirect;
  }

  // ==========================================
  // ساخت آدرس ورود
  // ==========================================
  function buildLoginRedirect(
    targetPath = null
  ) {
    const currentPath =
      targetPath ||
      window.location.pathname +
      window.location.search +
      window.location.hash;

    return `/login.html?redirect=${encodeURIComponent(
      currentPath
    )}`;
  }

  // ==========================================
  // اتصال فرم ثبت‌نام
  // ==========================================
  function bindRegisterForm(options = {}) {
    const form = document.querySelector(
      options.formSelector || "#register-form"
    );

    if (!form) return;

    const messageBox =
      document.querySelector(
        options.messageSelector ||
        "[data-auth-message]"
      );

    const submitButton =
      form.querySelector(
        'button[type="submit"]'
      );

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        setMessage(messageBox, "");

        const full_name =
          form.full_name?.value || "";

        const phone =
          form.phone?.value || "";

        const email =
          form.email?.value || "";

        const password =
          form.password?.value || "";

        // کد عبور اضافی
        const access_code =
          form.access_code?.value || "";

        if (submitButton) {
          submitButton.disabled = true;
        }

        try {
          const result =
            await register({
              full_name,
              phone,
              email,
              password,
              access_code
            });

          if (
            !result.ok ||
            !result.data?.success
          ) {
            setMessage(
              messageBox,
              result.data?.error ||
              "ثبت‌نام انجام نشد."
            );

            return;
          }

          setMessage(
            messageBox,
            "حساب کاربری با موفقیت ایجاد شد.",
            "success"
          );

          const redirectTarget =
            getRedirectParam();

          // بعد از ثبت‌نام موفق، مقصد پیش‌فرض صفحه اصلی است.
          const fallbackRedirect =
            options.redirectAfterSuccess ||
            "/";

          setTimeout(() => {
            redirectTo(
              redirectTarget ||
              fallbackRedirect,
              true
            );
          }, 700);

        } catch (error) {
          setMessage(
            messageBox,
            String(
              error?.message ||
              error ||
              "ثبت‌نام انجام نشد."
            )
          );
        } finally {
          if (submitButton) {
            submitButton.disabled = false;
          }
        }
      }
    );
  }

  // ==========================================
  // اتصال فرم ورود
  // ==========================================
  function bindLoginForm(options = {}) {
    const form = document.querySelector(
      options.formSelector || "#login-form"
    );

    if (!form) return;

    const messageBox =
      document.querySelector(
        options.messageSelector ||
        "[data-auth-message]"
      );

    const submitButton =
      form.querySelector(
        'button[type="submit"]'
      );

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        setMessage(messageBox, "");

        const email =
          form.email?.value ||
          form.identity?.value ||
          "";

        const password =
          form.password?.value || "";

        // کد عبور اضافی
        const access_code =
          form.access_code?.value || "";

        if (submitButton) {
          submitButton.disabled = true;
        }

        try {
          const result =
            await login({
              email,
              password,
              access_code
            });

          if (
            !result.ok ||
            !result.data?.success
          ) {
            setMessage(
              messageBox,
              result.data?.error ||
              "ورود انجام نشد."
            );

            return;
          }

          setMessage(
            messageBox,
            "ورود با موفقیت انجام شد.",
            "success"
          );

          const redirectTarget =
            getRedirectParam();

          // اگر مقصد مشخصی از صفحه خصوصی آمده باشد،
          // همان مقصد حفظ می‌شود.
          // در غیر این صورت، صفحه اصلی باز می‌شود.
          redirectTo(
            redirectTarget ||
            options.redirectAfterSuccess ||
            "/",
            true
          );

        } catch (error) {
          setMessage(
            messageBox,
            String(
              error?.message ||
              error ||
              "ورود انجام نشد."
            )
          );
        } finally {
          if (submitButton) {
            submitButton.disabled = false;
          }
        }
      }
    );
  }

  // ==========================================
  // اتصال دکمه خروج
  // ==========================================
  function bindLogoutButton(options = {}) {
    const button = document.querySelector(
      options.buttonSelector ||
      "[data-auth-logout]"
    );

    if (!button) return;

    button.addEventListener(
      "click",
      async (event) => {
        event.preventDefault();

        try {
          await logout();
        } catch {}

        redirectTo(
          options.redirectAfterSuccess ||
          "/index.html",
          true
        );
      }
    );
  }

  // ==========================================
  // الزام ورود
  // ==========================================
  async function requireAuth(options = {}) {
    const result =
      await getCurrentUser();

    if (
      !result.ok ||
      !result.data?.success ||
      !result.data?.user
    ) {
      redirectTo(
        buildLoginRedirect(
          options.redirectPath
        ),
        true
      );

      return null;
    }

    return result.data.user;
  }

  // ==========================================
  // الزام ادمین
  // ==========================================
  async function requireAdmin(options = {}) {
    const result =
      await getAdminUser();

    if (
      !result.ok ||
      !result.data?.success ||
      !result.data?.user
    ) {
      redirectTo(
        buildLoginRedirect(
          options.redirectPath ||
          "/admin.html"
        ),
        true
      );

      return null;
    }

    return result.data.user;
  }

  // ==========================================
  // انتقال کاربر واردشده
  // ==========================================
  async function redirectIfAuthenticated(
    options = {}
  ) {
    const result =
      await getCurrentUser();

    if (
      result.ok &&
      result.data?.success &&
      result.data?.user
    ) {
      // مقصد پیش‌فرض کاربر واردشده صفحه اصلی است.
      redirectTo(
        options.redirectTo ||
        "/",
        true
      );

      return result.data.user;
    }

    return null;
  }

  // ==========================================
  // محافظت از صفحات
  // ==========================================
  async function protectPage(options = {}) {
    const publicPaths =
      options.publicPaths || [
        "/",
        "/index.html",
        "/login.html",
        "/register.html"
      ];

    const currentPath =
      window.location.pathname;

    if (publicPaths.includes(currentPath)) {
      return null;
    }

    return requireAuth(options);
  }

  // ==========================================
  // تبدیل نقش به فارسی
  // ==========================================
  function faRole(value) {
    const map = {
      user: "مشتری",
      customer: "مشتری",
      admin: "ادمین",
      super_admin: "مدیر کل"
    };

    return (
      map[
        String(value || "").toLowerCase()
      ] || "نامشخص"
    );
  }

  // ==========================================
  // پر کردن اطلاعات کاربر
  // ==========================================
  function fillUserFields(
    user,
    options = {}
  ) {
    if (!user) return;

    const nameElements =
      document.querySelectorAll(
        options.nameSelector ||
        "[data-user-full-name]"
      );

    const emailElements =
      document.querySelectorAll(
        options.emailSelector ||
        "[data-user-email]"
      );

    const phoneElements =
      document.querySelectorAll(
        options.phoneSelector ||
        "[data-user-phone]"
      );

    const idElements =
      document.querySelectorAll(
        options.idSelector ||
        "[data-user-id]"
      );

    const roleElements =
      document.querySelectorAll(
        options.roleSelector ||
        "[data-user-role]"
      );

    const walletElements =
      document.querySelectorAll(
        options.walletSelector ||
        "[data-user-wallet]"
      );

    nameElements.forEach((el) => {
      if (
        "value" in el &&
        el.tagName === "INPUT"
      ) {
        el.value =
          user.full_name || "";
      } else {
        el.textContent =
          user.full_name || "";
      }
    });

    emailElements.forEach((el) => {
      if (
        "value" in el &&
        el.tagName === "INPUT"
      ) {
        el.value =
          user.email || "";
      } else {
        el.textContent =
          user.email || "";
      }
    });

    phoneElements.forEach((el) => {
      if (
        "value" in el &&
        el.tagName === "INPUT"
      ) {
        el.value =
          user.phone || "";
      } else {
        el.textContent =
          user.phone || "";
      }
    });

    idElements.forEach((el) => {
      const value =
        user.id != null
          ? String(user.id)
          : "";

      if (
        "value" in el &&
        el.tagName === "INPUT"
      ) {
        el.value = value;
      } else {
        el.textContent = value;
      }
    });

    roleElements.forEach((el) => {
      const value =
        faRole(user.role || "");

      if (
        "value" in el &&
        el.tagName === "INPUT"
      ) {
        el.value = value;
      } else {
        el.textContent = value;
      }
    });

    walletElements.forEach((el) => {
      const value =
        Number(
          user.wallet_balance || 0
        ).toLocaleString("fa-IR");

      if (
        "value" in el &&
        el.tagName === "INPUT"
      ) {
        el.value = value;
      } else {
        el.textContent = value;
      }
    });
  }

  return {
    register,
    login,
    logout,
    getCurrentUser,
    getAdminUser,
    getProfile,
    updateProfile,
    bindRegisterForm,
    bindLoginForm,
    bindLogoutButton,
    requireAuth,
    requireAdmin,
    redirectIfAuthenticated,
    protectPage,
    fillUserFields,
    setMessage
  };
})();

window.Auth = Auth;