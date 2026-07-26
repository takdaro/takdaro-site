(function () {
  function getProducts() {
    if (typeof window === "undefined") return [];
    if (!Array.isArray(window.PRODUCTS)) return [];
    return window.PRODUCTS;
  }

  function normalizeImageSrc(product) {
    if (Array.isArray(product.images) && product.images.length) {
      const firstImage = String(product.images[0] || "").trim();
      if (!firstImage) return "./assets/images/placeholder.png";
      if (firstImage.startsWith("http://") || firstImage.startsWith("https://")) {
        return firstImage;
      }
      if (firstImage.startsWith("/")) {
        return `.${firstImage}`;
      }
      return `./${firstImage.replace(/^\.?\//, "")}`;
    }

    return "./assets/images/placeholder.png";
  }

  function normalizePageUrl(product) {
    const rawPageUrl = String(product.pageUrl || "").trim();
    if (!rawPageUrl) return "#";
    if (rawPageUrl.startsWith("http://") || rawPageUrl.startsWith("https://")) {
      return rawPageUrl;
    }
    if (rawPageUrl.startsWith("/")) {
      return `.${rawPageUrl}`;
    }
    return `./${rawPageUrl.replace(/^\.?\//, "")}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createProductCard(product) {
    const imageSrc = normalizeImageSrc(product);
    const pageUrl = normalizePageUrl(product);
    const title = escapeHtml(product.name || "بدون نام");
    const category = escapeHtml(product.category || "محصول");
    const shortDescription = escapeHtml(product.shortDescription || "");
    const priceLabel = escapeHtml(product.priceLabel || product.displayPrice || "تماس بگیرید");
    const stockLabel = escapeHtml(
      product.stockLabel || (product.inStock ? "موجود" : "ناموجود")
    );
    const stockClass = product.inStock ? "in-stock" : "out-of-stock";

    return `
      <article class="product-card">
        <a href="${pageUrl}" class="product-card__image-link" aria-label="مشاهده محصول ${title}">
          <img
            src="${imageSrc}"
            alt="${title}"
            class="product-card__image"
            loading="lazy"
          />
        </a>

        <div class="product-card__body">
          <span class="product-card__category">${category}</span>

          <h3 class="product-card__title">
            <a href="${pageUrl}">${title}</a>
          </h3>

          <p class="product-card__text">${shortDescription}</p>

          <div class="product-card__meta">
            <strong class="product-card__price">${priceLabel}</strong>
            <span class="product-card__stock ${stockClass}">${stockLabel}</span>
          </div>

          <div class="product-card__actions">
            <a href="${pageUrl}" class="btn btn-primary">مشاهده محصول</a>
          </div>
        </div>
      </article>
    `;
  }

  function renderEmptyState(message) {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    grid.innerHTML = `
      <div class="empty-products">
        <h3>محصولی برای نمایش پیدا نشد.</h3>
        <p>${escapeHtml(message || "اطلاعات محصولات در دسترس نیست.")}</p>
      </div>
    `;
  }

  function renderProducts() {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    const products = getProducts();

    if (!products.length) {
      renderEmptyState("اطلاعات محصولات هنوز بارگذاری نشده یا خالی است.");
      return;
    }

    grid.innerHTML = products.map(createProductCard).join("");
  }

  function handleProductsReady(event) {
    const products = event?.detail?.products;
    if (!Array.isArray(products) || !products.length) {
      renderEmptyState("داده‌ای از API دریافت نشد.");
      return;
    }

    renderProducts();
  }

  function boot() {
    if (window.PRODUCTS_READY === true && getProducts().length) {
      renderProducts();
    } else {
      renderEmptyState("در حال بارگذاری محصولات...");
    }

    document.addEventListener("products:ready", handleProductsReady);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();