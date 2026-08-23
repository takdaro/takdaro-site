(function () {
  const API_URL = "/api/products";
  const FALLBACK_PRODUCTS = Array.isArray(window.PRODUCTS)
    ? window.PRODUCTS.slice()
    : [];

  function cleanText(value) {
    return String(value ?? "").trim();
  }

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toBoolean(value) {
    return value === true || value === 1 || value === "1";
  }

  function normalizeImagePath(value) {
    const path = cleanText(value);
    if (!path) return "";

    if (
      path.startsWith("http://") ||
      path.startsWith("https://") ||
      path.startsWith("/")
    ) {
      return path;
    }

    return `/${path.replace(/^\.?\//, "")}`;
  }

  function normalizePageUrl(value, slug) {
    const pageUrl = cleanText(value);

    if (pageUrl) {
      if (
        pageUrl.startsWith("http://") ||
        pageUrl.startsWith("https://") ||
        pageUrl.startsWith("/")
      ) {
        return pageUrl;
      }

      return `/${pageUrl.replace(/^\.?\//, "")}`;
    }

    return slug ? `/products/${encodeURIComponent(slug)}.html` : "#";
  }

  function formatPrice(price) {
    const amount = toNumber(price, 0);
    if (amount <= 0) return "تماس بگیرید";
    return `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;
  }

  function normalizeProduct(product) {
    const slug = cleanText(product?.slug);
    const stockQty = Math.max(0, Math.floor(toNumber(product?.stockQty || product?.stock_quantity, 0)));
    const inStock = toBoolean(product?.inStock || product?.in_stock) && stockQty > 0;

    // ⭐⭐⭐ اولویت اول: استفاده از displayPriceLabel محاسبه‌شده از سرور
    let priceLabel = cleanText(product?.displayPriceLabel || product?.priceLabel);
    let displayPrice = product?.displayPrice || product?.price || null;

    // اگر displayPriceLabel وجود نداشت، از logik قدیمی استفاده کن
    if (!priceLabel || priceLabel === "") {
      const numericPrice = toNumber(product?.price, 0);
      const hasValidPrice = numericPrice > 0;

      // اگر محصول وابسته به نرخ است و displayPrice دارد، از آن استفاده کن
      if (product?.price_type === 'rate_based' && product?.displayPrice !== null && product?.displayPrice !== undefined) {
        const displayPriceNum = toNumber(product?.displayPrice, 0);
        if (displayPriceNum > 0) {
          priceLabel = formatPrice(displayPriceNum);
          displayPrice = displayPriceNum;
        } else {
          priceLabel = cleanText(product?.priceLabel) || "تماس بگیرید";
        }
      } else if (hasValidPrice) {
        priceLabel = formatPrice(numericPrice);
        displayPrice = numericPrice;
      } else {
        priceLabel = cleanText(product?.priceLabel) || "تماس بگیرید";
        displayPrice = null;
      }
    } else {
      // اگر displayPriceLabel وجود دارد، سعی کن displayPrice را هم استخراج کنی
      if (product?.displayPrice !== null && product?.displayPrice !== undefined) {
        displayPrice = toNumber(product?.displayPrice, null);
      }
    }

    // اگر همچنان displayPrice مشخص نیست، از price استفاده کن
    if (displayPrice === null || displayPrice === undefined) {
      const numericPrice = toNumber(product?.price, 0);
      if (numericPrice > 0) {
        displayPrice = numericPrice;
      }
    }

    // استخراج price_type و سایر فیلدهای جدید
    const priceType = product?.price_type || product?.priceType || 'fixed';
    const basePrice = product?.base_price || product?.basePrice || null;
    const calculatedPrice = product?.calculated_price || product?.calculatedPrice || null;

    const imageList = Array.isArray(product?.images)
      ? product.images.map(normalizeImagePath).filter(Boolean)
      : [];

    const primaryImage = normalizeImagePath(product?.primaryImage || product?.primary_image);
    const images = Array.from(new Set([primaryImage, ...imageList].filter(Boolean)));

    return {
      id: Number(product?.id) || null,
      slug,
      name: cleanText(product?.name) || "بدون نام",
      category: cleanText(product?.category) || "محصول",
      price: toNumber(product?.price, null),
      priceLabel: priceLabel,
      displayPrice: displayPrice,
      displayPriceLabel: priceLabel,
      showPrice: toBoolean(product?.showPrice || product?.show_price),
      inStock,
      stockQty,
      stockLabel: inStock
        ? cleanText(product?.stockLabel || product?.stock_label) || "موجود"
        : "ناموجود",
      shortDescription: cleanText(product?.shortDescription || product?.short_description),
      description: cleanText(product?.description),
      primaryImage: primaryImage || images[0] || "",
      images,
      pageUrl: normalizePageUrl(product?.pageUrl || product?.page_url, slug),
      // ⭐ فیلدهای جدید سیستم نرخ ارز
      price_type: priceType,
      base_price: basePrice ? toNumber(basePrice, null) : null,
      calculated_price: calculatedPrice ? toNumber(calculatedPrice, null) : null
    };
  }

  function getFallbackProductMap() {
    const map = new Map();

    FALLBACK_PRODUCTS.forEach((product) => {
      const normalized = normalizeProduct(product);
      if (normalized.slug) {
        map.set(normalized.slug, normalized);
      }
    });

    return map;
  }

  function mergeWithFallback(apiProducts) {
    const fallbackMap = getFallbackProductMap();

    return apiProducts
      .map((product) => {
        const slug = cleanText(product?.slug);
        const fallback = fallbackMap.get(slug) || {};

        return normalizeProduct({
          ...fallback,
          ...product,
          images:
            Array.isArray(product?.images) && product.images.length
              ? product.images
              : fallback.images || [],
          primaryImage: product?.primaryImage || product?.primary_image || fallback.primaryImage || "",
          pageUrl: product?.pageUrl || product?.page_url || fallback.pageUrl || ""
        });
      })
      .filter((product) => product.slug);
  }

  function setProducts(products, source) {
    window.PRODUCTS = Array.isArray(products) ? products : [];
    window.PRODUCTS_READY = true;
    window.PRODUCTS_SOURCE = source;
  }

  function dispatchProductsReady(source, error) {
    document.dispatchEvent(
      new CustomEvent("products:ready", {
        detail: {
          products: Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [],
          source,
          error: error ? String(error?.message || error) : ""
        }
      })
    );
  }

  async function loadProductsFromApi() {
    try {
      const response = await fetch(API_URL, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        credentials: "same-origin"
      });

      const data = await response.json();

      if (!response.ok || !data?.success || !Array.isArray(data.products)) {
        throw new Error(data?.error || "دریافت اطلاعات محصولات ناموفق بود.");
      }

      const mergedProducts = mergeWithFallback(data.products);
      setProducts(mergedProducts, "api");
      dispatchProductsReady("api");
      return window.PRODUCTS;
    } catch (error) {
      const fallbackProducts = FALLBACK_PRODUCTS.map(normalizeProduct).filter(
        (product) => product.slug
      );

      setProducts(fallbackProducts, "fallback");
      console.warn("Products API is unavailable. Fallback data was used.", error);
      dispatchProductsReady("fallback", error);
      return window.PRODUCTS;
    }
  }

  window.ProductsApi = {
    load: loadProductsFromApi,
    getProducts: function () {
      return Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
    },
    isReady: function () {
      return window.PRODUCTS_READY === true;
    }
  };

  window.PRODUCTS = Array.isArray(window.PRODUCTS)
    ? window.PRODUCTS.map(normalizeProduct).filter((product) => product.slug)
    : [];

  window.PRODUCTS_READY = false;
  window.PRODUCTS_SOURCE = "";
  window.PRODUCTS_LOADING = loadProductsFromApi();
})();