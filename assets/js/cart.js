(function () {
  const CART_KEY = "takdaro_cart";
  const LEGACY_CART_KEYS = ["taktejarat_cart"];
  let cartEventsBound = false;
  let cartToggleBound = false;

  function getBasePath() {
    const path = window.location.pathname;
    if (path.includes("/products/")) return "../";
    return "./";
  }

  function normalizeCartItems(items) {
    if (!Array.isArray(items)) return [];

    return items
      .map((item) => {
        if (!item || !item.slug) return null;

        return {
          slug: String(item.slug),
          qty: Math.max(1, Number(item.qty || item.quantity || 1)),
          name: item.name || "",
          category: item.category || "",
          image: item.image || ""
        };
      })
      .filter(Boolean);
  }

  function migrateLegacyCart() {
    try {
      const current = localStorage.getItem(CART_KEY);

      if (current) {
        const parsed = JSON.parse(current);
        localStorage.setItem(CART_KEY, JSON.stringify(normalizeCartItems(parsed)));
        return;
      }

      for (const oldKey of LEGACY_CART_KEYS) {
        const legacyValue = localStorage.getItem(oldKey);
        if (!legacyValue) continue;

        const parsed = JSON.parse(legacyValue);
        localStorage.setItem(CART_KEY, JSON.stringify(normalizeCartItems(parsed)));
        localStorage.removeItem(oldKey);
        break;
      }
    } catch (error) {}
  }

  function readCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return normalizeCartItems(parsed);
    } catch (error) {
      return [];
    }
  }

  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(normalizeCartItems(cart)));
  }

  function findProduct(slug) {
    const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
    return products.find((item) => item.slug === slug) || null;
  }

  function buildCartItemFromProduct(slug, qty, product) {
    const image =
      Array.isArray(product?.images) && product.images.length
        ? product.images[0]
        : "";

    return {
      slug: String(slug),
      qty: Math.max(1, Number(qty || 1)),
      name: product?.name || "",
      category: product?.category || "",
      image
    };
  }

  function getCartDetailed() {
    return readCart()
      .map((item) => {
        const product = findProduct(item.slug);

        return {
          slug: item.slug,
          qty: Number(item.qty || 0),
          product: {
            slug: item.slug,
            name: product?.name || item.name || "",
            category: product?.category || item.category || "",
            images: Array.isArray(product?.images)
              ? product.images
              : item.image
              ? [item.image]
              : []
          }
        };
      })
      .filter((item) => item.qty > 0);
  }

  function getCartCount() {
    return readCart().reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }

  function updateCartBadge() {
    const badges = document.querySelectorAll(
      "[data-cart-count], [data-cart-badge], .cart-badge"
    );
    const count = getCartCount();

    badges.forEach((badge) => {
      badge.textContent = count;
      badge.hidden = count === 0;
      badge.style.display = count > 0 ? "inline-flex" : "none";
    });
  }

  function renderMiniCart() {
    const container = document.querySelector("[data-mini-cart-items]");
    const empty = document.querySelector("[data-mini-cart-empty]");
    const footer = document.querySelector("[data-mini-cart-footer]");

    if (!container || !empty || !footer) return;

    const base = getBasePath();
    const items = getCartDetailed();
    container.innerHTML = "";

    if (!items.length) {
      empty.hidden = false;
      footer.hidden = true;
      return;
    }

    empty.hidden = true;
    footer.hidden = false;

    items.forEach(({ slug, qty, product }) => {
      const image =
        Array.isArray(product.images) && product.images.length
          ? product.images[0]
          : "";
      const imageSrc = image ? `${base}${image}` : "";

      const article = document.createElement("article");
      article.className = "mini-cart-item";
      article.innerHTML = `
        <div class="mini-cart-item__image">
          ${imageSrc ? `<img src="${imageSrc}" alt="${product.name || ""}">` : ""}
        </div>
        <div class="mini-cart-item__body">
          <h4>${product.name || ""}</h4>
          <p>${product.category || ""}</p>
          <div class="mini-cart-item__controls">
            <button type="button" data-cart-action="increase" data-slug="${slug}" aria-label="افزایش تعداد">+</button>
            <span>${qty}</span>
            <button type="button" data-cart-action="decrease" data-slug="${slug}" aria-label="کاهش تعداد">-</button>
            <button type="button" data-cart-action="remove" data-slug="${slug}" class="mini-cart-remove">حذف</button>
          </div>
        </div>
      `;
      container.appendChild(article);
    });
  }

  function syncCartUi() {
    updateCartBadge();
    renderMiniCart();
  }

  function saveCart(cart) {
    writeCart(cart);
    syncCartUi();
  }

  function addToCart(slug, qty) {
    const product = findProduct(slug);
    if (!product) return;

    const quantity = Math.max(1, parseInt(qty, 10) || 1);
    const cart = readCart();
    const existing = cart.find((item) => item.slug === slug);

    if (existing) {
      existing.qty += quantity;
      existing.name = product.name || existing.name || "";
      existing.category = product.category || existing.category || "";
      existing.image =
        (Array.isArray(product.images) && product.images[0]) || existing.image || "";
    } else {
      cart.push(buildCartItemFromProduct(slug, quantity, product));
    }

    saveCart(cart);
  }

  function updateQuantity(slug, qty) {
    const cart = readCart();
    const item = cart.find((entry) => entry.slug === slug);
    if (!item) return;

    item.qty = Math.max(1, parseInt(qty, 10) || 1);
    saveCart(cart);
  }

  function increaseItem(slug) {
    const cart = readCart();
    const item = cart.find((entry) => entry.slug === slug);
    if (!item) return;

    item.qty += 1;
    saveCart(cart);
  }

  function decreaseItem(slug) {
    const cart = readCart();
    const item = cart.find((entry) => entry.slug === slug);
    if (!item) return;

    item.qty -= 1;

    if (item.qty <= 0) {
      removeItem(slug);
      return;
    }

    saveCart(cart);
  }

  function removeItem(slug) {
    const cart = readCart().filter((item) => item.slug !== slug);
    saveCart(cart);
  }

  function clearCart() {
    saveCart([]);
  }

  function openCart() {
    const drawer = document.querySelector("[data-cart-drawer]");
    const overlay = document.querySelector("[data-cart-overlay]");
    if (!drawer || !overlay) return;

    renderMiniCart();
    drawer.classList.add("is-open");
    overlay.hidden = false;
  }

  function closeCart() {
    const drawer = document.querySelector("[data-cart-drawer]");
    const overlay = document.querySelector("[data-cart-overlay]");
    if (!drawer || !overlay) return;

    drawer.classList.remove("is-open");
    overlay.hidden = true;
  }

  function setupMiniCartEvents() {
    if (cartEventsBound) return;
    cartEventsBound = true;

    document.addEventListener("click", function (event) {
      const openTrigger = event.target.closest("[data-open-cart]");
      if (openTrigger) {
        openCart();
        return;
      }

      const closeTrigger = event.target.closest("[data-close-cart], [data-cart-overlay]");
      if (closeTrigger) {
        closeCart();
        return;
      }

      const trigger = event.target.closest("[data-cart-action]");
      if (trigger) {
        const action = trigger.getAttribute("data-cart-action");
        const slug = trigger.getAttribute("data-slug");
        if (!slug) return;

        if (action === "increase") increaseItem(slug);
        if (action === "decrease") decreaseItem(slug);
        if (action === "remove") removeItem(slug);
        return;
      }

      const addButton = event.target.closest("[data-add-to-cart]");
      if (addButton) {
        const slug = addButton.getAttribute("data-add-to-cart");
        const qtyTarget = addButton.getAttribute("data-qty-target");
        let qty = 1;

        if (qtyTarget) {
          const input = document.querySelector(qtyTarget);
          if (input) qty = parseInt(input.value, 10) || 1;
        }

        if (slug) {
          addToCart(slug, qty);
          openCart();
        }
      }
    });
  }

  function setupMiniCartToggle() {
    if (cartToggleBound) return;
    cartToggleBound = true;
  }

  function initCartUi() {
    migrateLegacyCart();
    syncCartUi();
    setupMiniCartEvents();
    setupMiniCartToggle();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCartUi);
  } else {
    initCartUi();
  }

  document.addEventListener("layout:loaded", initCartUi);

  window.CartStore = {
    readCart,
    getCartDetailed,
    addToCart,
    updateQuantity,
    increaseItem,
    decreaseItem,
    removeItem,
    clearCart,
    getCartCount,
    initCartUi,
    updateCartBadge,
    renderMiniCart,
    openCart,
    closeCart
  };
})();