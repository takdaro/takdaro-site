(function () {
  const CART_KEY = "taktejarat_cart";

  function readCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge();
    renderMiniCart();
  }

  function findProduct(slug) {
    const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
    return products.find((item) => item.slug === slug);
  }

  function getCartDetailed() {
    const cart = readCart();

    return cart
      .map((item) => {
        const product = findProduct(item.slug);
        if (!product) return null;

        return {
          ...item,
          product
        };
      })
      .filter(Boolean);
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
      cart.push({
        slug,
        qty: quantity
      });
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

  function getCartCount() {
    return readCart().reduce((sum, item) => sum + (item.qty || 0), 0);
  }

  function updateCartBadge() {
    const badges = document.querySelectorAll("[data-cart-count]");
    const count = getCartCount();

    badges.forEach((badge) => {
      badge.textContent = count;
      badge.hidden = count === 0;
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
      const article = document.createElement("article");
      article.className = "mini-cart-item";
      article.innerHTML = `
        <div class="mini-cart-item__image">
          <img src="./${product.images[0]}" alt="${product.name}">
        </div>
        <div class="mini-cart-item__body">
          <h4>${product.name}</h4>
          <p>${product.category}</p>

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

  function setupMiniCartEvents() {
    document.addEventListener("click", function (event) {
      const trigger = event.target.closest("[data-cart-action]");
      if (!trigger) return;

      const action = trigger.getAttribute("data-cart-action");
      const slug = trigger.getAttribute("data-slug");
      if (!slug) return;

      if (action === "increase") increaseItem(slug);
      if (action === "decrease") decreaseItem(slug);
      if (action === "remove") removeItem(slug);
    });

    document.addEventListener("click", function (event) {
      const addButton = event.target.closest("[data-add-to-cart]");
      if (!addButton) return;

      const slug = addButton.getAttribute("data-add-to-cart");
      const qtyTarget = addButton.getAttribute("data-qty-target");
      let qty = 1;

      if (qtyTarget) {
        const input = document.querySelector(qtyTarget);
        if (input) qty = parseInt(input.value, 10) || 1;
      }

      addToCart(slug, qty);
    });
  }

  function setupMiniCartToggle() {
    const openButtons = document.querySelectorAll("[data-open-cart]");
    const closeButtons = document.querySelectorAll("[data-close-cart]");
    const drawer = document.querySelector("[data-cart-drawer]");
    const overlay = document.querySelector("[data-cart-overlay]");

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
      button.addEventListener("click", openCart);
    });

    closeButtons.forEach((button) => {
      button.addEventListener("click", closeCart);
    });

    overlay.addEventListener("click", closeCart);
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateCartBadge();
    renderMiniCart();
    setupMiniCartEvents();
    setupMiniCartToggle();
  });

  window.CartStore = {
    readCart,
    getCartDetailed,
    addToCart,
    updateQuantity,
    increaseItem,
    decreaseItem,
    removeItem,
    clearCart,
    getCartCount
  };
})();

function initCartUi() {
  updateCartBadge();
  renderMiniCart();
  setupMiniCartEvents();
  setupMiniCartToggle();
}

document.addEventListener("DOMContentLoaded", function () {
  updateCartBadge();
});

document.addEventListener("layout:loaded", function () {
  initCartUi();
});