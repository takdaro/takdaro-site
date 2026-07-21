(function () {
  const CART_KEY = "takdaro_cart";
  let cartEventsBound = false;
  let cartToggleBound = false;

  function readCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function findProduct(slug) {
    const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
    return products.find((item) => item.slug === slug) || null;
  }

  function getCartDetailed() {
    return readCart()
      .map((item) => {
        const product = findProduct(item.slug);
        if (!product) return null;

        return {
          slug: item.slug,
          qty: Number(item.qty || 0),
          product
        };
      })
      .filter(Boolean);
  }

  function getCartCount() {
    return readCart().reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }

  function updateCartBadge() {
    const badges = document.querySelectorAll("[data-cart-count], [data-cart-badge], .cart-badge");
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
      const image = Array.isArray(product.images) && product.images.length ? product.images[0] : "";
      const article = document.createElement("article");
      article.className = "mini-cart-item";
      article.innerHTML = `
        <div class="mini-cart-item__image">
          ${image ? `<img src="./${image}" alt="${product.name}">` : ""}
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
    } else {
      cart.push({ slug, qty: quantity });
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

  function setupMiniCartEvents() {
    if (cartEventsBound) return;
    cartEventsBound = true;

    document.addEventListener("click", function (event) {
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
        }
      }
    });
  }

  function setupMiniCartToggle() {
    const drawer = document.querySelector("[data-cart-drawer]");
    const overlay = document.querySelector("[data-cart-overlay]");
    const openButtons = document.querySelectorAll("[data-open-cart]");
    const closeButtons = document.querySelectorAll("[data-close-cart]");

    if (!drawer || !overlay) return;

    function openCart() {
      drawer.classList.add("is-open");
      overlay.hidden = false;
    }

    function closeCart() {
      drawer.classList.remove("is-open");
      overlay.hidden = true;
    }

    openButtons.forEach((button) => {
      if (button.dataset.cartBound === "true") return;
      button.dataset.cartBound = "true";
      button.addEventListener("click", openCart);
    });

    closeButtons.forEach((button) => {
      if (button.dataset.cartBound === "true") return;
      button.dataset.cartBound = "true";
      button.addEventListener("click", closeCart);
    });

    if (!cartToggleBound) {
      cartToggleBound = true;
      overlay.addEventListener("click", closeCart);
    }
  }

  function initCartUi() {
    syncCartUi();
    setupMiniCartEvents();
    setupMiniCartToggle();
  }

  document.addEventListener("DOMContentLoaded", initCartUi);
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
    renderMiniCart
  };
})();