(function () {
  function getProducts() {
    if (typeof window === "undefined") return [];
    if (!Array.isArray(window.PRODUCTS)) return [];
    return window.PRODUCTS;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatPrice(product) {
    if (product?.showPrice && Number(product?.price) > 0) {
      return `${new Intl.NumberFormat("fa-IR").format(Number(product.price))} تومان`;
    }
    return escapeHtml(product?.priceLabel || product?.displayPrice || "تماس بگیرید");
  }

  function normalizeAssetPath(path) {
    const value = String(path || "").trim();

    if (!value) return "./assets/images/placeholder.png";
    if (value.startsWith("http://") || value.startsWith("https://")) return value;
    if (value.startsWith("/")) return `.${value}`;
    return `./${value.replace(/^\.?\//, "")}`;
  }

  function resolveProductSlug() {
    const productRoot =
      document.querySelector("[data-product-slug]") ||
      document.querySelector("[data-product-root]") ||
      document.querySelector("main[data-product-slug]");

    const datasetSlug = productRoot?.dataset?.productSlug;
    if (datasetSlug) {
      return String(datasetSlug).trim().toLowerCase();
    }

    const path = String(window.location.pathname || "").trim();
    const fileName = path.split("/").pop() || "";
    const normalizedFileName = fileName.replace(/\.html?$/i, "");

    if (normalizedFileName) {
      return normalizedFileName.toLowerCase();
    }

    const params = new URLSearchParams(window.location.search);
    const slugFromQuery = params.get("slug");
    return slugFromQuery ? slugFromQuery.trim().toLowerCase() : "";
  }

  function findProductBySlug(slug) {
    if (!slug) return null;

    return (
      getProducts().find((product) => {
        return String(product?.slug || "").trim().toLowerCase() === slug;
      }) || null
    );
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (!element) return;
    element.textContent = value ?? "";
  }

  function setHtml(selector, value) {
    const element = document.querySelector(selector);
    if (!element) return;
    element.innerHTML = value ?? "";
  }

  function setImage(selector, src, alt) {
    const element = document.querySelector(selector);
    if (!element) return;

    element.src = src;
    element.alt = alt || "";
  }

  function renderGallery(product) {
    const mainImage =
      document.querySelector("[data-product-main-image]") ||
      document.querySelector(".product-detail__main-image img") ||
      document.querySelector(".product-main-image");

    const thumbsWrap =
      document.querySelector("[data-product-thumbs]") ||
      document.querySelector(".product-detail__thumbs") ||
      document.querySelector(".product-gallery-thumbs");

    const images = Array.isArray(product?.images) && product.images.length
      ? product.images
      : [product?.primaryImage].filter(Boolean);

    const normalizedImages = images
      .map(normalizeAssetPath)
      .filter(Boolean);

    const firstImage = normalizedImages[0] || "./assets/images/placeholder.png";

    if (mainImage) {
      mainImage.src = firstImage;
      mainImage.alt = product?.name || "تصویر محصول";
    }

    if (!thumbsWrap) return;

    thumbsWrap.innerHTML = normalizedImages.map((image, index) => {
      const activeClass = index === 0 ? " is-active" : "";
      return `
        <button
          type="button"
          class="product-thumb${activeClass}"
          data-product-thumb="${escapeHtml(image)}"
          aria-label="مشاهده تصویر ${index + 1}"
        >
          <img src="${image}" alt="${escapeHtml(product?.name || "محصول")}" loading="lazy" />
        </button>
      `;
    }).join("");

    thumbsWrap.querySelectorAll("[data-product-thumb]").forEach((button) => {
      button.addEventListener("click", function () {
        const nextImage = this.getAttribute("data-product-thumb");
        if (mainImage && nextImage) {
          mainImage.src = nextImage;
        }

        thumbsWrap.querySelectorAll("[data-product-thumb]").forEach((item) => {
          item.classList.remove("is-active");
        });

        this.classList.add("is-active");
      });
    });
  }

  function renderStock(product) {
    const stockText = product?.stockLabel || (product?.inStock ? "موجود" : "ناموجود");
    const stockClass = product?.inStock ? "in-stock" : "out-of-stock";

    const stockTargets = document.querySelectorAll(
      "[data-product-stock], .product-stock, .product-detail__stock"
    );

    stockTargets.forEach((element) => {
      element.textContent = stockText;
      element.classList.remove("in-stock", "out-of-stock");
      element.classList.add(stockClass);
    });
  }

  function renderPrice(product) {
    const priceText = formatPrice(product);

    document.querySelectorAll(
      "[data-product-price], .product-price, .product-detail__price"
    ).forEach((element) => {
      element.textContent = priceText;
    });
  }

  function renderMeta(product) {
    setText("[data-product-name]", product?.name || "بدون نام");
    setText("[data-product-category]", product?.category || "محصول");
    setText("[data-product-short-description]", product?.shortDescription || "");
    setText("[data-product-description]", product?.description || "");
    setText("title", product?.name ? `${product.name} | تک تجارت` : "جزئیات محصول | تک تجارت");

    const breadcrumbCurrent =
      document.querySelector("[data-breadcrumb-current]") ||
      document.querySelector(".breadcrumb .is-current");

    if (breadcrumbCurrent) {
      breadcrumbCurrent.textContent = product?.name || "جزئیات محصول";
    }

    const mainImage =
      document.querySelector("[data-product-main-image]") ||
      document.querySelector(".product-detail__main-image img") ||
      document.querySelector(".product-main-image");

    if (mainImage) {
      setImage(
        mainImage.tagName === "IMG" ? "[data-product-main-image], .product-detail__main-image img, .product-main-image" : "",
        normalizeAssetPath(product?.primaryImage || product?.images?.[0]),
        product?.name || "تصویر محصول"
      );
    }
  }

  function renderAddToCart(product) {
    const buttons = document.querySelectorAll("[data-add-to-cart]");

    buttons.forEach((button) => {
      button.dataset.productId = String(product?.id ?? "");
      button.dataset.productSlug = String(product?.slug ?? "");
      button.disabled = !product?.inStock;
      button.textContent = product?.inStock ? "افزودن به سبد خرید" : "ناموجود";

      button.onclick = function () {
        if (!window.Cart || typeof window.Cart.add !== "function") return;

        const result = window.Cart.add(product.slug, 1);

        if (result?.message) {
          alert(result.message);
        }
      };
    });
  }

  function renderProduct(product) {
    if (!product) {
      renderNotFound("محصول موردنظر پیدا نشد.");
      return;
    }

    renderMeta(product);
    renderPrice(product);
    renderStock(product);
    renderGallery(product);
    renderAddToCart(product);

    document.querySelectorAll("[data-product-root], .product-detail, .product-page").forEach((element) => {
      element.classList.remove("is-loading");
      element.classList.add("is-ready");
    });
  }

  function renderNotFound(message) {
    const root =
      document.querySelector("[data-product-root]") ||
      document.querySelector(".product-detail") ||
      document.querySelector(".product-page") ||
      document.querySelector("main");

    if (!root) return;

    root.innerHTML = `
      <section class="empty-products">
        <h2>محصول پیدا نشد</h2>
        <p>${escapeHtml(message || "اطلاعات این محصول در دسترس نیست.")}</p>
        <a href="./products.html" class="btn btn-primary">بازگشت به محصولات</a>
      </section>
    `;
  }

  function tryRenderProduct() {
    const slug = resolveProductSlug();

    if (!slug) {
      renderNotFound("اسلاگ محصول از صفحه قابل تشخیص نیست.");
      return false;
    }

    const product = findProductBySlug(slug);

    if (!product) {
      return false;
    }

    renderProduct(product);
    return true;
  }

  function boot() {
    if (window.PRODUCTS_READY === true) {
      const ok = tryRenderProduct();
      if (!ok) {
        renderNotFound("محصولی با این آدرس در داده‌های فعلی پیدا نشد.");
      }
    } else {
      document.addEventListener("products:ready", function onProductsReady() {
        document.removeEventListener("products:ready", onProductsReady);
        const ok = tryRenderProduct();
        if (!ok) {
          renderNotFound("محصولی با این آدرس در API پیدا نشد.");
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();