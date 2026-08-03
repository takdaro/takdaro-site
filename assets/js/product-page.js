(function () {
  function getRoot() {
    return document.querySelector("[data-product-root]");
  }

  function getSlug() {
    const root = getRoot();
    return root?.dataset?.productSlug || "";
  }

  function getProducts() {
    return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  }

  function findProduct() {
    const slug = getSlug();
    if (!slug) return null;
    return getProducts().find((item) => item.slug === slug) || null;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("fa-IR").format(value);
  }

  function formatPrice(product) {
    if (!product) return "تماس بگیرید";
    
    // ⭐ اولویت با displayPriceLabel (قیمت محاسبه‌شده)
    if (product.displayPriceLabel) {
      return product.displayPriceLabel;
    }
    
    // رفتار قبلی
    if (product.priceLabel) return product.priceLabel;
    if (typeof product.price === "number" && Number.isFinite(product.price) && product.price > 0) {
      return `${formatNumber(product.price)} تومان`;
    }
    return "تماس بگیرید";
  }

  function getStockQty(product) {
    return Math.max(0, Number(product?.stockQty || 0));
  }

  function isAvailable(product) {
    return !!product && !!product.inStock && getStockQty(product) > 0;
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = value;
    });
  }

  function normalizeImage(src) {
    if (!src) return "";
    if (src.startsWith("http://") || src.startsWith("https://")) return src;
    if (src.startsWith("/")) return src;
    return `/${String(src).replace(/^\.?\//, "")}`;
  }

  function renderGallery(product) {
    const mainImage = document.querySelector("[data-product-main-image]");
    const thumbsWrap = document.querySelector("[data-product-thumbs]");
    const images = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];

    if (!mainImage || !thumbsWrap || !images.length) return;

    mainImage.src = normalizeImage(images[0]);
    mainImage.alt = product.name || "تصویر محصول";

    thumbsWrap.innerHTML = images
      .map((img, index) => {
        const src = normalizeImage(img);
        const activeClass = index === 0 ? " is-active" : "";
        return `
          <button
            type="button"
            class="product-thumb${activeClass}"
            data-image="${src}"
            aria-label="تصویر ${index + 1} محصول ${product.name || ""}"
          >
            <img src="${src}" alt="" />
          </button>
        `;
      })
      .join("");

    thumbsWrap.querySelectorAll(".product-thumb").forEach((thumb) => {
      thumb.addEventListener("click", () => {
        const image = thumb.getAttribute("data-image");
        if (!image) return;
        mainImage.src = image;
        thumbsWrap.querySelectorAll(".product-thumb").forEach((item) => {
          item.classList.remove("is-active");
        });
        thumb.classList.add("is-active");
      });
    });
  }

  function renderProduct(product) {
    if (!product) return;

    setText("[data-product-name]", product.name || "بدون نام");
    setText("[data-product-category]", product.category || "محصول");
    setText(
      "[data-product-short-description]",
      product.shortDescription || "مشاهده اطلاعات محصول."
    );
    setText(
      "[data-product-description]",
      product.description ||
        product.shortDescription ||
        "اطلاعات کامل این محصول از API بارگذاری می‌شود."
    );
    setText("[data-breadcrumb-current]", product.name || "محصول");

    const priceEl = document.getElementById("product-price");
    const stockEl = document.getElementById("product-stock");
    const stockQtyEl = document.getElementById("product-stock-qty");
    const addToCartBtn = document.getElementById("add-to-cart-btn");

    if (priceEl) {
      priceEl.textContent = formatPrice(product);
    }

    if (stockEl) {
      const available = isAvailable(product);
      stockEl.textContent = available ? (product.stockLabel || "موجود") : "ناموجود";
      stockEl.classList.toggle("in-stock", available);
      stockEl.classList.toggle("out-of-stock", !available);
    }

    if (stockQtyEl) {
      stockQtyEl.textContent = `موجودی انبار: ${
        getStockQty(product) > 0 ? formatNumber(getStockQty(product)) : "-"
      }`;
    }

    if (addToCartBtn) {
      addToCartBtn.dataset.productSlug = product.slug || getSlug();
    }

    renderGallery(product);
    applyPurchaseState(product);
  }

  function normalizeQty(product) {
    const quantityInput = document.getElementById("product-quantity");
    if (!quantityInput) return 1;

    const stockQty = getStockQty(product);
    let value = parseInt(quantityInput.value, 10);

    if (isNaN(value) || value < 1) value = 1;
    if (stockQty > 0 && value > stockQty) value = stockQty;

    quantityInput.value = value;
    return value;
  }

  function applyPurchaseState(product) {
    const addToCartBtn = document.getElementById("add-to-cart-btn");
    const quantityInput = document.getElementById("product-quantity");
    const increaseBtn = document.getElementById("increase-qty");
    const decreaseBtn = document.getElementById("decrease-qty");

    if (!addToCartBtn || !quantityInput) return;

    const stockQty = getStockQty(product);
    const available = isAvailable(product);

    if (!available) {
      addToCartBtn.disabled = true;
      addToCartBtn.textContent = "ناموجود";
      addToCartBtn.style.opacity = "0.6";
      addToCartBtn.style.cursor = "not-allowed";

      quantityInput.value = 0;
      quantityInput.min = 0;
      quantityInput.max = 0;
      quantityInput.disabled = true;

      if (increaseBtn) increaseBtn.disabled = true;
      if (decreaseBtn) decreaseBtn.disabled = true;
      return;
    }

    addToCartBtn.disabled = false;
    addToCartBtn.textContent = "افزودن به سبد خرید";
    addToCartBtn.style.opacity = "1";
    addToCartBtn.style.cursor = "pointer";

    quantityInput.disabled = false;
    quantityInput.min = 1;
    quantityInput.max = stockQty;

    if (!quantityInput.value || Number(quantityInput.value) < 1) {
      quantityInput.value = 1;
    }

    if (increaseBtn) increaseBtn.disabled = false;
    if (decreaseBtn) decreaseBtn.disabled = false;

    normalizeQty(product);
  }

  function getCartApi() {
    if (window.CartStore && typeof window.CartStore.addToCart === "function") {
      return { addToCart: window.CartStore.addToCart };
    }
    if (window.Cart && typeof window.Cart.add === "function") {
      return { addToCart: window.Cart.add };
    }
    return null;
  }

  function bindPurchaseEvents() {
    const quantityInput = document.getElementById("product-quantity");
    const increaseBtn = document.getElementById("increase-qty");
    const decreaseBtn = document.getElementById("decrease-qty");
    const addToCartBtn = document.getElementById("add-to-cart-btn");

    if (increaseBtn) {
      increaseBtn.addEventListener("click", () => {
        const product = findProduct();
        if (!isAvailable(product) || !quantityInput) return;
        const current = normalizeQty(product);
        const stockQty = getStockQty(product);
        quantityInput.value = Math.min(current + 1, stockQty);
        quantityInput.focus();
      });
    }

    if (decreaseBtn) {
      decreaseBtn.addEventListener("click", () => {
        const product = findProduct();
        if (!quantityInput || quantityInput.disabled) return;
        const current = normalizeQty(product);
        quantityInput.value = Math.max(1, current - 1);
        quantityInput.focus();
      });
    }

    if (quantityInput) {
      quantityInput.addEventListener("input", () => {
        const product = findProduct();
        if (!quantityInput.disabled) normalizeQty(product);
      });
      quantityInput.addEventListener("blur", () => {
        const product = findProduct();
        if (!quantityInput.disabled) normalizeQty(product);
      });
    }

    if (addToCartBtn) {
      addToCartBtn.addEventListener("click", () => {
        const product = findProduct();
        const cartApi = getCartApi();

        if (!isAvailable(product)) {
          alert("این محصول ناموجود است.");
          return;
        }

        if (!cartApi) {
          console.warn("Cart API در دسترس نیست.");
          return;
        }

        const qty = normalizeQty(product);
        const stockQty = getStockQty(product);
        const slug = addToCartBtn.dataset.productSlug || getSlug();

        if (qty > stockQty) {
          alert(`حداکثر تعداد قابل سفارش ${formatNumber(stockQty)} عدد است.`);
          if (quantityInput) quantityInput.value = stockQty;
          return;
        }

        const result = cartApi.addToCart(slug, qty);
        if (result && result.success === false && result.message) {
          alert(result.message);
          return;
        }

        const cartOpenBtn = document.querySelector("[data-open-cart]");
        if (cartOpenBtn) cartOpenBtn.click();
      });
    }
  }

  function renderCurrentProduct() {
    const product = findProduct();
    if (product) {
      renderProduct(product);
    }
  }

  function init() {
    bindPurchaseEvents();
    renderCurrentProduct();

    document.addEventListener("products:ready", (event) => {
      const readyProducts = event?.detail?.products;
      if (Array.isArray(readyProducts)) {
        renderCurrentProduct();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();