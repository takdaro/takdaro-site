(function () {
  function getProducts() {
    if (typeof window === "undefined") return [];
    if (!window.PRODUCTS || !Array.isArray(window.PRODUCTS)) return [];
    return window.PRODUCTS;
  }

  function createProductCard(product) {
    const imageSrc =
      Array.isArray(product.images) && product.images.length
        ? `./${product.images[0]}`
        : "/assets/images/placeholder.png";

    const pageUrl = product.pageUrl ? `./${product.pageUrl}` : "#";
    const title = product.name || "بدون نام";
    const category = product.category || "محصول";
    const shortDescription = product.shortDescription || "";
    const priceLabel = product.priceLabel || "تماس بگیرید";
    const stockLabel = product.stockLabel || (product.inStock ? "موجود" : "ناموجود");
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

  function renderProducts() {
    const grid = document.getElementById("products-grid");
    console.log("grid =>", grid);

    if (!grid) {
      console.error("products-grid not found");
      return;
    }

    const products = getProducts();
    console.log("products =>", products);

    if (!products.length) {
      grid.innerHTML = `
        <div class="empty-products">
          <h3>محصولی برای نمایش پیدا نشد.</h3>
          <p>فایل products.js را بررسی کنید.</p>
        </div>
      `;
      return;
    }

    const markup = products.map(createProductCard).join("");
    console.log("markup length =>", markup.length);

    grid.innerHTML = markup;
    console.log("render completed");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderProducts);
  } else {
    renderProducts();
  }
})();

