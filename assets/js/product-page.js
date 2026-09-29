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
    if (!isAvailable(product)) return "موجود نیست؛ در حال تأمین";

    if (product.displayPriceLabel) {
      return product.displayPriceLabel;
    }

    if (product.priceLabel) {
      return product.priceLabel;
    }

    if (
      typeof product.price === "number" &&
      Number.isFinite(product.price) &&
      product.price > 0
    ) {
      return `${formatNumber(product.price)} تومان`;
    }

    return "تماس بگیرید";
  }

  function getStockQty(product) {
    return Math.max(0, Number(product?.stockQty || 0));
  }

  function getPurchaseMinQty(product) {
    const parsed = Number(product?.purchaseMinQty ?? product?.purchase_min_quantity);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
  }

  function getPurchaseMaxQty(product) {
    const stockQty = getStockQty(product);
    const parsed = Number(product?.purchaseMaxQty ?? product?.purchase_max_quantity);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return Math.min(Math.floor(parsed), stockQty);
    }
    return stockQty;
  }

  function isAvailable(product) {
    return !!product && !!product.inStock && getStockQty(product) > 0;
  }

  function showMinQuantityMessage(product, minQty) {
    const productName = product?.name || "این محصول";
    alert(
      `حداقل انتخاب این محصول ${productName} کمتر از ${formatNumber(minQty)} عدد نیست.`
    );
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = value;
    });
  }

  function normalizeImage(src) {
    if (!src) return "";

    if (src.startsWith("http://") || src.startsWith("https://")) {
      return src;
    }

    if (src.startsWith("/")) {
      return src;
    }

    return `/${String(src).replace(/^\.?\//, "")}`;
  }

  function renderGallery(product) {
    const mainImage = document.querySelector("[data-product-main-image]");
    const thumbsWrap = document.querySelector("[data-product-thumbs]");

    const images = Array.isArray(product?.images)
      ? product.images.filter(Boolean)
      : [];

    if (!mainImage || !thumbsWrap || !images.length) {
      return;
    }

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

    // Customer-facing order: short description, user quantity selection, then full details.
    const details = document.querySelector('.product-details');
    const purchase = details?.querySelector('.product-single__purchase');
    const fullDescription = details?.querySelector('.product-single__content');
    if (details && purchase && fullDescription) {
      details.insertBefore(purchase, fullDescription);
    }

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

      stockEl.textContent = available
        ? product.stockLabel || "موجود"
        : "ناموجود";

      stockEl.classList.toggle("in-stock", available);
      stockEl.classList.toggle("out-of-stock", !available);
    }

    if (stockQtyEl) {
      const stockQty = getStockQty(product);

      stockQtyEl.textContent = `موجودی انبار: ${
        stockQty > 0 ? formatNumber(stockQty) : "-"
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
    const minQty = getPurchaseMinQty(product);
    const maxQty = getPurchaseMaxQty(product);

    let value = parseInt(quantityInput.value, 10);

    if (isNaN(value) || value < minQty) {
      value = minQty;
    }

    if (stockQty > 0 && value > maxQty) {
      value = maxQty;
    }

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
    const available = isAvailable(product) && getPurchaseMaxQty(product) >= getPurchaseMinQty(product);
    const minQty = getPurchaseMinQty(product);
    const maxQty = Math.max(minQty, getPurchaseMaxQty(product));

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
    quantityInput.min = minQty;
    quantityInput.max = maxQty;

    if (!quantityInput.value || Number(quantityInput.value) < minQty) {
      quantityInput.value = minQty;
    }

    if (increaseBtn) increaseBtn.disabled = false;
    if (decreaseBtn) decreaseBtn.disabled = false;

    normalizeQty(product);
  }

  function getCartApi() {
    if (
      window.CartStore &&
      typeof window.CartStore.addToCart === "function"
    ) {
      return {
        addToCart: window.CartStore.addToCart
      };
    }

    if (window.Cart && typeof window.Cart.add === "function") {
      return {
        addToCart: window.Cart.add
      };
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

        const maxQty = getPurchaseMaxQty(product);
        quantityInput.value = Math.min(current + 1, maxQty);
        quantityInput.focus();
      });
    }

    if (decreaseBtn) {
      decreaseBtn.addEventListener("click", () => {
        const product = findProduct();

        if (!quantityInput || quantityInput.disabled) return;

        const current = normalizeQty(product);
        const minQty = getPurchaseMinQty(product);

        if (current <= minQty) {
          quantityInput.value = minQty;
          showMinQuantityMessage(product, minQty);
          quantityInput.focus();
          return;
        }

        quantityInput.value = Math.max(minQty, current - 1);
        quantityInput.focus();
      });
    }

    if (quantityInput) {
      quantityInput.addEventListener("input", () => {
        const product = findProduct();

        if (!quantityInput.disabled) {
          normalizeQty(product);
        }
      });

      quantityInput.addEventListener("blur", () => {
        const product = findProduct();

        if (!quantityInput.disabled) {
          const minQty = getPurchaseMinQty(product);
          const rawValue = parseInt(quantityInput.value, 10);
          if (!Number.isNaN(rawValue) && rawValue < minQty) {
            showMinQuantityMessage(product, minQty);
          }
          normalizeQty(product);
        }
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
        const minQty = getPurchaseMinQty(product);
        const maxQty = getPurchaseMaxQty(product);
        const slug = addToCartBtn.dataset.productSlug || getSlug();

        if (qty < minQty) {
          showMinQuantityMessage(product, minQty);

          if (quantityInput) {
            quantityInput.value = minQty;
          }

          return;
        }

        if (qty > maxQty) {
          alert(
            `حداکثر تعداد قابل سفارش ${formatNumber(maxQty)} عدد است.`
          );

          if (quantityInput) {
            quantityInput.value = maxQty;
          }

          return;
        }

        const result = cartApi.addToCart(slug, qty);

        if (result && result.success === false && result.message) {
          alert(result.message);
          return;
        }

        const cartOpenBtn = document.querySelector("[data-open-cart]");

        if (cartOpenBtn) {
          cartOpenBtn.click();
        }
      });
    }
  }

  function renderCurrentProduct() {
    const product = findProduct();

    if (product) {
      renderProduct(product);
    }
  }

  /*
   * فقط برای همگام‌سازی موجودی واقعی:
   * داده جدید مستقیماً از /api/products گرفته می‌شود،
   * سپس ProductsApi، window.PRODUCTS را به‌روزرسانی می‌کند
   * و products:ready باعث render مجدد موجودی می‌شود.
   */
  async function refreshProductStock() {
    if (
      !window.ProductsApi ||
      typeof window.ProductsApi.load !== "function"
    ) {
      return;
    }

    try {
      await window.ProductsApi.load();
      renderCurrentProduct();
    } catch (error) {
      console.warn("خطا در به‌روزرسانی موجودی محصول.", error);
    }
  }

  function bindStockRefreshEvents() {
    /*
     * وقتی کاربر پس از ثبت سفارش به این صفحه برمی‌گردد،
     * موجودی جدید مستقیماً از API خوانده می‌شود.
     */
    window.addEventListener("focus", () => {
      refreshProductStock();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        refreshProductStock();
      }
    });

    /*
     * برای بازگشت از صفحه Checkout با دکمه Back مرورگر.
     */
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        refreshProductStock();
      }
    });
  }

  function init() {
    bindPurchaseEvents();
    bindStockRefreshEvents();

    renderCurrentProduct();

    document.addEventListener("products:ready", (event) => {
      const readyProducts = event?.detail?.products;

      if (Array.isArray(readyProducts)) {
        renderCurrentProduct();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    init();
  }
})();
