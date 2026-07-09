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
    const title = product.name || "Ø¨Ø¯ÙˆÙ† Ù†Ø§Ù…";
    const category = product.category || "Ù…Ø­ØµÙˆÙ„";
    const shortDescription = product.shortDescription || "";
    const priceLabel = product.priceLabel || "ØªÙ…Ø§Ø³ Ø¨Ú¯ÛŒØ±ÛŒØ¯";
    const stockLabel = product.stockLabel || (product.inStock ? "Ù…ÙˆØ¬ÙˆØ¯" : "Ù†Ø§Ù…ÙˆØ¬ÙˆØ¯");
    const stockClass = product.inStock ? "in-stock" : "out-of-stock";

    return `
      <article class="product-card">
        <a href="${pageUrl}" class="product-card__image-link" aria-label="Ù…Ø´Ø§Ù‡Ø¯Ù‡ Ù…Ø­ØµÙˆÙ„ ${title}">
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
            <a href="${pageUrl}" class="btn btn-primary">Ù…Ø´Ø§Ù‡Ø¯Ù‡ Ù…Ø­ØµÙˆÙ„</a>
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
          <h3>Ù…Ø­ØµÙˆÙ„ÛŒ Ø¨Ø±Ø§ÛŒ Ù†Ù…Ø§ÛŒØ´ Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯.</h3>
          <p>ÙØ§ÛŒÙ„ products.js Ø±Ø§ Ø¨Ø±Ø±Ø³ÛŒ Ú©Ù†ÛŒØ¯.</p>
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
