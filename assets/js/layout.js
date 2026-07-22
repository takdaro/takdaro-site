(function () {
  function getBasePath() {
    const path = window.location.pathname;

    if (path.includes("/products/")) {
      return "../";
    }

    return "./";
  }

  async function loadPartial(targetId, filePath) {
    const target = document.getElementById(targetId);
    if (!target) return;

    try {
      const response = await fetch(filePath);
      const html = await response.text();
      const base = getBasePath();
      target.innerHTML = html.replaceAll("{{BASE}}", base);
    } catch (error) {
      console.error(`خطا در بارگذاری ${filePath}`, error);
    }
  }

  function setupMobileMenu() {
    const menuToggle = document.querySelector(".menu-toggle");
    const mobileNav = document.querySelector("#site-menu");

    if (!menuToggle || !mobileNav) return;

    if (menuToggle.dataset.bound === "true") return;
    menuToggle.dataset.bound = "true";

    menuToggle.addEventListener("click", function () {
      const isOpen = mobileNav.classList.toggle("is-open");
      menuToggle.classList.toggle("is-active", isOpen);
      menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      menuToggle.setAttribute(
        "aria-label",
        isOpen ? "بستن منو" : "باز کردن منو"
      );
    });

    document.addEventListener("click", function (event) {
      const clickedInsideMenu = mobileNav.contains(event.target);
      const clickedToggle = menuToggle.contains(event.target);

      if (!clickedInsideMenu && !clickedToggle && mobileNav.classList.contains("is-open")) {
        mobileNav.classList.remove("is-open");
        menuToggle.classList.remove("is-active");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "باز کردن منو");
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 820) {
        mobileNav.classList.remove("is-open");
        menuToggle.classList.remove("is-active");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "باز کردن منو");
      }
    });
  }

  async function updateHeaderAuthState() {
    const guestLinks = document.querySelectorAll("[data-auth-guest]");
    const userLinks = document.querySelectorAll("[data-auth-user]");

    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });

      const data = await response.json().catch(() => null);
      const isLoggedIn = Boolean(response.ok && data?.success && data?.user);

      guestLinks.forEach((node) => {
        node.hidden = isLoggedIn;
      });

      userLinks.forEach((node) => {
        node.hidden = !isLoggedIn;
      });
    } catch (error) {
      guestLinks.forEach((node) => {
        node.hidden = false;
      });

      userLinks.forEach((node) => {
        node.hidden = true;
      });
    }
  }

  function setupLogoutAction() {
    const logoutButtons = document.querySelectorAll("[data-logout-trigger]");

    logoutButtons.forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";

      button.addEventListener("click", async function () {
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "در حال خروج...";

        try {
          const response = await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin",
            headers: {
              Accept: "application/json"
            }
          });

          const data = await response.json().catch(() => null);

          if (!response.ok || !data?.success) {
            throw new Error("logout-failed");
          }

          window.location.href = `${getBasePath()}login.html`;
        } catch (error) {
          button.disabled = false;
          button.textContent = originalText;
          alert("خروج از حساب انجام نشد. دوباره تلاش کنید.");
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", async function () {
    const base = getBasePath();

    await loadPartial("site-header", `${base}components/header.html`);
    setupMobileMenu();
    setupLogoutAction();
    await updateHeaderAuthState();

    await loadPartial("site-footer", `${base}components/footer.html`);
    await loadPartial("site-cart", `${base}components/cart-drawer.html`);

    document.dispatchEvent(new CustomEvent("layout:loaded"));
  });
})();