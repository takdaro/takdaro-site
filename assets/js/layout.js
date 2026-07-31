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

          window.location.replace(`${getBasePath()}index.html`);
        } catch (error) {
          button.disabled = false;
          button.textContent = originalText;
          alert("خروج از حساب انجام نشد. دوباره تلاش کنید.");
        }
      });
    });
  }

  function formatPrice(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount) || amount <= 0) {
      return "تماس بگیرید";
    }

    return `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;
  }

  function getCartApi() {
    if (window.Cart && typeof window.Cart.getItems === "function") {
      return {
        getItems: window.Cart.getItems,
        getItemCount: window.Cart.getItemCount,
        getTotalPrice: window.Cart.getTotalPrice,
        update: window.Cart.update,
        remove: window.Cart.remove,
        clear: window.Cart.clear,
        formatPrice: window.Cart.formatPrice || formatPrice
      };
    }

    if (window.CartStore && typeof window.CartStore.getItems === "function") {
      return {
        getItems: window.CartStore.getItems,
        getItemCount: window.CartStore.getItemCount,
        getTotalPrice: window.CartStore.getTotalPrice,
        update: window.CartStore.updateQuantity,
        remove: window.CartStore.removeFromCart,
        clear: window.CartStore.clearCart,
        formatPrice: window.CartStore.formatPrice || formatPrice
      };
    }

    return null;
  }

  function openCartDrawer() {
    const drawer = document.querySelector("[data-cart-drawer]");
    const overlay = document.querySelector("[data-cart-overlay]");
    if (!drawer) return;

    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");

    if (overlay) {
      overlay.hidden = false;
      overlay.classList.add("is-open");
    }

    document.body.classList.add("cart-open");
  }

  function closeCartDrawer() {
    const drawer = document.querySelector("[data-cart-drawer]");
    const overlay = document.querySelector("[data-cart-overlay]");
    if (!drawer) return;

    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");

    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove("is-open");
    }

    document.body.classList.remove("cart-open");
  }

  function renderCartDrawer() {
    const cartApi = getCartApi();
    const list = document.querySelector("[data-cart-items]");
    const total = document.querySelector("[data-cart-total]");
    const empty = document.querySelector("[data-cart-empty]");
    const count = document.querySelector("[data-cart-count-label]");
    const footer = document.querySelector(".cart-drawer__footer");

    if (!list || !total || !empty || !count || !footer || !cartApi) return;

    const items = Array.isArray(cartApi.getItems()) ? cartApi.getItems() : [];
    const itemCount =
      typeof cartApi.getItemCount === "function" ? cartApi.getItemCount() : 0;
    const totalPrice =
      typeof cartApi.getTotalPrice === "function" ? cartApi.getTotalPrice() : null;
    const priceFormatter =
      typeof cartApi.formatPrice === "function" ? cartApi.formatPrice : formatPrice;

    count.textContent = `${new Intl.NumberFormat("fa-IR").format(itemCount)} محصول`;

    if (!items.length) {
      list.innerHTML = "";
      empty.hidden = false;
      footer.hidden = true;
      total.textContent = "۰ تومان";
      return;
    }

    empty.hidden = true;
    footer.hidden = false;

    list.innerHTML = items
      .map((item) => {
        const product = item.product || {};
        const slug = product.slug || item.slug || "";
        const image =
          product.primaryImage ||
          (Array.isArray(product.images) ? product.images[0] : "") ||
          "/assets/images/placeholder.png";
        const pageUrl = product.pageUrl || "#";
        const name = product.name || "محصول";
        const qty = Number(item.quantity) || 1;
        const unitPrice = item.unitPrice;
        const linePrice = item.totalPrice;

        return `
          <div class="cart-drawer__item" data-cart-item="${slug}">
            <a class="cart-drawer__item-image" href="${pageUrl}">
              <img src="${image}" alt="${name}" loading="lazy" />
            </a>

            <div class="cart-drawer__item-content">
              <a class="cart-drawer__item-title" href="${pageUrl}">${name}</a>

              <div class="cart-drawer__item-meta">
                <span>${unitPrice === null ? "تماس بگیرید" : priceFormatter(unitPrice)}</span>
                <span>تعداد: ${new Intl.NumberFormat("fa-IR").format(qty)}</span>
              </div>

              <div class="cart-drawer__item-actions">
                <button type="button" data-cart-decrease="${slug}" aria-label="کاهش تعداد">-</button>
                <button type="button" data-cart-increase="${slug}" aria-label="افزایش تعداد">+</button>
                <button type="button" data-cart-remove="${slug}" aria-label="حذف از سبد">حذف</button>
              </div>

              <div class="cart-drawer__item-line-price">
                ${linePrice === null ? "تماس بگیرید" : priceFormatter(linePrice)}
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    total.textContent = totalPrice === null ? "تماس بگیرید" : priceFormatter(totalPrice);

    bindCartItemActions();
  }

  function bindCartItemActions() {
    const cartApi = getCartApi();
    if (!cartApi) return;

    document.querySelectorAll("[data-cart-increase]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";

      button.addEventListener("click", function () {
        const slug = button.getAttribute("data-cart-increase");
        const items = cartApi.getItems();
        const currentItem = items.find((item) => {
          return item.slug === slug || item.product?.slug === slug;
        });
        const currentQty = Number(currentItem?.quantity || 0);

        if (typeof cartApi.update === "function") {
          cartApi.update(slug, currentQty + 1);
        }
      });
    });

    document.querySelectorAll("[data-cart-decrease]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";

      button.addEventListener("click", function () {
        const slug = button.getAttribute("data-cart-decrease");
        const items = cartApi.getItems();
        const currentItem = items.find((item) => {
          return item.slug === slug || item.product?.slug === slug;
        });
        const currentQty = Number(currentItem?.quantity || 0);

        if (typeof cartApi.update === "function") {
          cartApi.update(slug, currentQty - 1);
        }
      });
    });

    document.querySelectorAll("[data-cart-remove]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";

      button.addEventListener("click", function () {
        const slug = button.getAttribute("data-cart-remove");

        if (typeof cartApi.remove === "function") {
          cartApi.remove(slug);
        }
      });
    });
  }

  function setupCartDrawer() {
    const drawer = document.querySelector("[data-cart-drawer]");
    const overlay = document.querySelector("[data-cart-overlay]");
    if (!drawer) return;

    document.querySelectorAll("[data-open-cart]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";

      button.addEventListener("click", function (event) {
        event.preventDefault();
        openCartDrawer();
      });
    });

    document.querySelectorAll("[data-close-cart]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";

      button.addEventListener("click", function () {
        closeCartDrawer();
      });
    });

    if (overlay) {
      overlay.addEventListener("click", function () {
        closeCartDrawer();
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeCartDrawer();
      }
    });

    renderCartDrawer();
    document.addEventListener("cart:updated", renderCartDrawer);
    document.addEventListener("products:ready", renderCartDrawer);
  }

  // ==========================================
  // 🔹 مدیریت Bottom Navigation
  // ==========================================
  function setupBottomNav() {
    const items = document.querySelectorAll(".bottom-nav__item");
    const currentPath = window.location.pathname;

    items.forEach((item) => {
      const href = item.getAttribute("href");
      if (!href) return;

      // تشخیص صفحه فعال بر اساس مسیر
      const isActive = 
        (href === "/index.html" && (currentPath === "/" || currentPath === "/index.html")) ||
        (href !== "/index.html" && currentPath.includes(href.replace("/", "")));

      if (isActive) {
        item.classList.add("is-active");
        item.setAttribute("aria-current", "page");
      }

      // کلیک روی آیتم
      item.addEventListener("click", function (e) {
        // اگر لینک به صفحه فعلی باشد، از رفتن جلوگیری کن
        if (this.classList.contains("is-active")) {
          e.preventDefault();
        }
      });
    });
  }

  // ==========================================
  // 🔹 به‌روزرسانی Badge سبد خرید در Bottom Nav
  // ==========================================
  function updateBottomCartBadge() {
    const cartApi = getCartApi();
    const badge = document.querySelector("[data-cart-count-badge]");
    if (!badge || !cartApi) return;

    const count = typeof cartApi.getItemCount === "function" ? cartApi.getItemCount() : 0;

    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove("bottom-nav__badge--hidden");
    } else {
      badge.classList.add("bottom-nav__badge--hidden");
    }
  }

  // ==========================================
  // بارگذاری اولیه
  // ==========================================
  document.addEventListener("DOMContentLoaded", async function () {
    const base = getBasePath();

    await loadPartial("site-header", `${base}components/header.html`);
    setupMobileMenu();
    setupLogoutAction();
    await updateHeaderAuthState();

    await loadPartial("site-footer", `${base}components/footer.html`);
    await loadPartial("site-cart", `${base}components/cart-drawer.html`);
    await loadPartial("bottom-nav", `${base}components/bottom-nav.html`);

    setupCartDrawer();
    setupBottomNav();

    // به‌روزرسانی اولیه Badge
    setTimeout(() => {
      updateBottomCartBadge();
    }, 100);

    // گوش دادن به رویداد به‌روزرسانی سبد
    document.addEventListener("cart:updated", function () {
      updateBottomCartBadge();
    });

    document.dispatchEvent(new CustomEvent("layout:loaded"));
  });
})();