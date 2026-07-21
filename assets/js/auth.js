const Auth = (() => {
  const endpoints = {
    register: "/api/auth/register",
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    me: "/api/auth/me",
    profile: "/api/auth/profile"
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

  async function register(payload) {
    return request(endpoints.register, {
      method: "POST",
      body: JSON.stringify({
        full_name: String(payload.full_name || "").trim(),
        mobile: String(payload.mobile || "").trim(),
        email: String(payload.email || "").trim(),
        password: String(payload.password || "")
      })
    });
  }

  async function login(payload) {
    return request(endpoints.login, {
      method: "POST",
      body: JSON.stringify({
        email: String(payload.email || "").trim(),
        password: String(payload.password || "")
      })
    });
  }

  async function logout() {
    return request(endpoints.logout, {
      method: "POST"
    });
  }

  async function getCurrentUser() {
    return request(endpoints.me, {
      method: "GET"
    });
  }

  async function getProfile() {
    return request(endpoints.profile, {
      method: "GET"
    });
  }

  async function updateProfile(payload) {
    return request(endpoints.profile, {
      method: "POST",
      body: JSON.stringify({
        full_name: String(payload.full_name || "").trim(),
        email: String(payload.email || "").trim(),
        mobile: String(payload.mobile || "").trim(),
        password: String(payload.password || ""),
        password_confirm: String(payload.password_confirm || "")
      })
    });
  }

  function setMessage(element, message, type = "error") {
    if (!element) return;
    element.textContent = message || "";
    element.style.display = message ? "block" : "none";
    element.classList.remove("is-error", "is-success");
    element.classList.add(type === "success" ? "is-success" : "is-error");
  }

  function redirectTo(url, replace = false) {
    if (replace) {
      window.location.replace(url);
      return;
    }
    window.location.href = url;
  }

  function bindRegisterForm(options = {}) {
    const form = document.querySelector(options.formSelector || "#register-form");
    if (!form) return;

    const messageBox = document.querySelector(options.messageSelector || "[data-auth-message]");
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setMessage(messageBox, "");

      const full_name = form.full_name?.value || "";
      const mobile = form.mobile?.value || "";
      const email = form.email?.value || "";
      const password = form.password?.value || "";

      if (submitButton) submitButton.disabled = true;

      try {
        const result = await register({ full_name, mobile, email, password });

        if (!result.ok || !result.data?.success) {
          setMessage(messageBox, result.data?.error || "Registration failed.");
          return;
        }

        setMessage(messageBox, "Account created successfully.", "success");

        if (options.redirectAfterSuccess) {
          setTimeout(() => {
            redirectTo(options.redirectAfterSuccess, true);
          }, 700);
        }
      } catch (error) {
        setMessage(messageBox, String(error?.message || error || "Registration failed."));
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  function bindLoginForm(options = {}) {
    const form = document.querySelector(options.formSelector || "#login-form");
    if (!form) return;

    const messageBox = document.querySelector(options.messageSelector || "[data-auth-message]");
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setMessage(messageBox, "");

      const email = form.email?.value || form.identity?.value || "";
      const password = form.password?.value || "";

      if (submitButton) submitButton.disabled = true;

      try {
        const result = await login({ email, password });

        if (!result.ok || !result.data?.success) {
          setMessage(messageBox, result.data?.error || "Login failed.");
          return;
        }

        setMessage(messageBox, "Login successful.", "success");
        redirectTo(options.redirectAfterSuccess || "/account.html", true);
      } catch (error) {
        setMessage(messageBox, String(error?.message || error || "Login failed."));
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  function bindLogoutButton(options = {}) {
    const button = document.querySelector(options.buttonSelector || "[data-auth-logout]");
    if (!button) return;

    button.addEventListener("click", async (event) => {
      event.preventDefault();

      try {
        await logout();
      } catch {}

      redirectTo(options.redirectAfterSuccess || "/login.html", true);
    });
  }

  async function requireAuth(options = {}) {
    const result = await getCurrentUser();

    if (!result.ok || !result.data?.success || !result.data?.user) {
      redirectTo(options.redirectTo || "/login.html", true);
      return null;
    }

    return result.data.user;
  }

  async function redirectIfAuthenticated(options = {}) {
    const result = await getCurrentUser();

    if (result.ok && result.data?.success && result.data?.user) {
      redirectTo(options.redirectTo || "/account.html", true);
      return result.data.user;
    }

    return null;
  }

  function fillUserFields(user, options = {}) {
    if (!user) return;

    const nameElements = document.querySelectorAll(options.nameSelector || "[data-user-full-name]");
    const emailElements = document.querySelectorAll(options.emailSelector || "[data-user-email]");
    const mobileElements = document.querySelectorAll(options.mobileSelector || "[data-user-mobile]");
    const idElements = document.querySelectorAll(options.idSelector || "[data-user-id]");

    nameElements.forEach((el) => {
      if ("value" in el && el.tagName === "INPUT") {
        el.value = user.full_name || "";
      } else {
        el.textContent = user.full_name || "";
      }
    });

    emailElements.forEach((el) => {
      if ("value" in el && el.tagName === "INPUT") {
        el.value = user.email || "";
      } else {
        el.textContent = user.email || "";
      }
    });

    mobileElements.forEach((el) => {
      if ("value" in el && el.tagName === "INPUT") {
        el.value = user.mobile || "";
      } else {
        el.textContent = user.mobile || "";
      }
    });

    idElements.forEach((el) => {
      const value = user.id != null ? String(user.id) : "";
      if ("value" in el && el.tagName === "INPUT") {
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
    getProfile,
    updateProfile,
    bindRegisterForm,
    bindLoginForm,
    bindLogoutButton,
    requireAuth,
    redirectIfAuthenticated,
    fillUserFields,
    setMessage
  };
})();

window.Auth = Auth;