import { getCurrentRate, calculateProductPrice } from "../lib/rate";

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=60",
      ...headers
    }
  });
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function toBoolean(value) {
  return Number(value) === 1 || value === true;
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

  return `/products/${encodeURIComponent(slug)}.html`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function buildPriceLabel(product, displayPrice) {
  // اگر محصول وابسته به نرخ است و قیمت محاسبه شده دارد
  if (product.price_type === 'rate_based' && displayPrice !== null && displayPrice > 0) {
    return `${formatNumber(displayPrice)} تومان`;
  }

  // اگر محصول ثابت است و قیمت دارد
  const price = Number(product.price);
  const hasValidPrice = Number.isFinite(price) && price > 0;

  if (toBoolean(product.show_price) && hasValidPrice) {
    return `${formatNumber(price)} تومان`;
  }

  return cleanText(product.price_label) || "تماس بگیرید";
}

function buildStockLabel(product) {
  const stockQuantity = Math.max(0, Number.parseInt(product.stock_quantity, 10) || 0);
  const inStock = toBoolean(product.in_stock) && stockQuantity > 0;

  if (!inStock) {
    return "ناموجود";
  }

  return cleanText(product.stock_label) || "موجود";
}

function productFromRow(product, imageRows, rate) {
  const stockQty = Math.max(
    0,
    Number.parseInt(product.stock_quantity, 10) || 0
  );

  const inStock = toBoolean(product.in_stock) && stockQty > 0;

  const galleryImages = imageRows
    .filter((image) => Number(image.product_id) === Number(product.id))
    .map((image) => normalizeImagePath(image.image_url))
    .filter(Boolean);

  const primaryImage = normalizeImagePath(product.primary_image);

  const images = Array.from(
    new Set([
      primaryImage,
      ...galleryImages
    ].filter(Boolean))
  );

  // ⭐ محاسبه قیمت نهایی برای محصولات وابسته به نرخ
  let displayPrice = null;
  let priceType = product.price_type || 'fixed';
  let basePrice = product.base_price !== null && product.base_price !== undefined ? Number(product.base_price) : null;
  let calculatedPrice = product.calculated_price !== null && product.calculated_price !== undefined ? Number(product.calculated_price) : null;
  
  // اگر محصول وابسته به نرخ است و نرخ موجود است
  if (priceType === 'rate_based' && basePrice !== null && basePrice > 0 && rate !== null) {
    // از calculated_price استفاده کن (اگر وجود دارد و به‌روز است)
    // یا دوباره محاسبه کن
    if (calculatedPrice !== null && calculatedPrice > 0) {
      displayPrice = calculatedPrice;
    } else {
      // محاسبه مجدد
      displayPrice = calculateProductPrice(product, rate);
    }
  } else if (priceType === 'fixed') {
    // محصول ثابت - از price استفاده کن
    const price = Number(product.price);
    if (Number.isFinite(price) && price > 0) {
      displayPrice = price;
    }
  }

  // اگر displayPrice هنوز null است، از price استفاده کن (برای سازگاری)
  if (displayPrice === null) {
    const price = Number(product.price);
    if (Number.isFinite(price) && price > 0) {
      displayPrice = price;
    }
  }

  return {
    id: Number(product.id),
    slug: cleanText(product.slug),
    name: cleanText(product.name),
    category: cleanText(product.category),
    price: Number(product.price) || null,
    displayPrice: displayPrice,
    priceLabel: buildPriceLabel(product, displayPrice),
    displayPriceLabel: buildPriceLabel(product, displayPrice),
    showPrice: toBoolean(product.show_price),
    inStock,
    stockQty,
    stockLabel: buildStockLabel(product),
    shortDescription: cleanText(product.short_description),
    description: cleanText(product.description),
    primaryImage: primaryImage || images[0] || "",
    images,
    pageUrl: normalizePageUrl(product.page_url, product.slug),
    // ⭐ فیلدهای جدید برای سیستم نرخ ارز
    priceType: priceType,
    basePrice: basePrice,
    profitType: product.profit_type || 'none',
    profitValue: product.profit_value !== null && product.profit_value !== undefined ? Number(product.profit_value) : null,
    fixedFee: product.fixed_fee !== null && product.fixed_fee !== undefined ? Number(product.fixed_fee) : null,
    roundingType: product.rounding_type || 'none',
    roundingMethod: product.rounding_method || 'nearest',
    calculatedPrice: calculatedPrice
  };
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}

export async function onRequestGet(context) {
  try {
    const db = context.env?.DB;

    if (!db) {
      return json(
        {
          success: false,
          error: "D1 database binding DB is not configured."
        },
        500
      );
    }

    const url = new URL(context.request.url);
    const requestedSlug = cleanText(url.searchParams.get("slug"));
    const requestedCategory = cleanText(url.searchParams.get("category"));
    const includeOutOfStock = url.searchParams.get("include_out_of_stock") === "1";

    // ⭐ دریافت نرخ فعلی دلار
    let currentRate = null;
    try {
      const rateResult = await getCurrentRate(context.env, 'USD');
      if (rateResult) {
        currentRate = rateResult.rate;
      }
    } catch (rateError) {
      // اگر نرخ دریافت نشد، از مقدار پیش‌فرض استفاده کن
      console.warn("Could not fetch current rate, using fallback:", rateError);
      currentRate = 196000; // نرخ پیش‌فرض
    }

    const conditions = ["p.status = 'published'"];
    const bindings = [];

    if (requestedSlug) {
      conditions.push("p.slug = ?");
      bindings.push(requestedSlug);
    }

    if (requestedCategory) {
      conditions.push("p.category = ?");
      bindings.push(requestedCategory);
    }

    if (!includeOutOfStock) {
      conditions.push("p.in_stock = 1");
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const productsQuery = `
      SELECT
        p.id,
        p.slug,
        p.name,
        p.category,
        p.price,
        p.price_label,
        p.show_price,
        p.stock_quantity,
        p.in_stock,
        p.stock_label,
        p.short_description,
        p.description,
        p.primary_image,
        p.page_url,
        p.status,
        p.created_at,
        p.updated_at,
        -- ⭐ فیلدهای جدید سیستم نرخ ارز
        p.price_type,
        p.base_price,
        p.profit_type,
        p.profit_value,
        p.fixed_fee,
        p.rounding_type,
        p.rounding_method,
        p.calculated_price,
        p.price_calculated_at
      FROM products p
      ${whereClause}
      ORDER BY
        CASE WHEN p.in_stock = 1 AND p.stock_quantity > 0 THEN 0 ELSE 1 END,
        p.id ASC
    `;

    const productsResult = bindings.length
      ? await db.prepare(productsQuery).bind(...bindings).all()
      : await db.prepare(productsQuery).all();

    const productRows = Array.isArray(productsResult?.results)
      ? productsResult.results
      : [];

    if (!productRows.length) {
      return json({
        success: true,
        total: 0,
        products: [],
        rate: currentRate
      });
    }

    const productIds = productRows.map((product) => Number(product.id));
    const placeholders = productIds.map(() => "?").join(",");

    const imagesQuery = `
      SELECT
        id,
        product_id,
        image_url,
        alt_text,
        sort_order,
        is_primary
      FROM product_images
      WHERE product_id IN (${placeholders})
      ORDER BY
        product_id ASC,
        is_primary DESC,
        sort_order ASC,
        id ASC
    `;

    const imagesResult = await db
      .prepare(imagesQuery)
      .bind(...productIds)
      .all();

    const imageRows = Array.isArray(imagesResult?.results)
      ? imagesResult.results
      : [];

    const products = productRows.map((product) =>
      productFromRow(product, imageRows, currentRate)
    );

    return json({
      success: true,
      total: products.length,
      products,
      rate: currentRate
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: String(error?.message || error)
      },
      500,
      {
        "Cache-Control": "no-store"
      }
    );
  }
}