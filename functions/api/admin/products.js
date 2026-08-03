import { requireAdmin, logAdminAction } from "../../lib/admin";
import { getCurrentRate, calculateProductPrice } from "../../lib/rate";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}

function cleanText(value, maxLength = 10000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanSlug(value) {
  return cleanText(value, 160)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPositiveId(value) {
  const id = toInteger(value, 0);
  return id > 0 ? id : 0;
}

function toOptionalPrice(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value).replace(/[,\s]/g, "");
  const parsed = Number.parseInt(normalized, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function toBooleanInteger(value, fallback = 0) {
  if (typeof value === "boolean") return value ? 1 : 0;

  const normalized = String(value ?? "").toLowerCase().trim();

  if (["1", "true", "yes", "on"].includes(normalized)) return 1;
  if (["0", "false", "no", "off", ""].includes(normalized)) return 0;

  return fallback ? 1 : 0;
}

function normalizeStatus(value) {
  const status = cleanText(value, 30).toLowerCase();

  if (["published", "draft", "private"].includes(status)) {
    return status;
  }

  return "draft";
}

function normalizeImageUrl(value) {
  const url = cleanText(value, 2000);

  if (!url) return "";

  if (
    url.startsWith("/") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }

  return `/${url.replace(/^\.?\//, "")}`;
}

function normalizeImages(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const images = [];

  for (let index = 0; index < source.length; index += 1) {
    const item = source[index];

    const imageUrl = normalizeImageUrl(
      typeof item === "string" ? item : item?.image_url ?? item?.imageUrl
    );

    if (!imageUrl || seen.has(imageUrl)) continue;

    seen.add(imageUrl);

    images.push({
      image_url: imageUrl,
      alt_text: cleanText(
        typeof item === "string"
          ? ""
          : item?.alt_text ?? item?.altText,
        300
      ),
      sort_order: Math.max(
        0,
        toInteger(
          typeof item === "string"
            ? index + 1
            : item?.sort_order ?? item?.sortOrder,
          index + 1
        )
      ),
      is_primary: toBooleanInteger(
        typeof item === "string"
          ? index === 0
          : item?.is_primary ?? item?.isPrimary,
        index === 0
      )
    });
  }

  if (images.length > 0) {
    const firstPrimaryIndex = images.findIndex(
      (image) => image.is_primary === 1
    );

    images.forEach((image, index) => {
      image.is_primary =
        index === (firstPrimaryIndex >= 0 ? firstPrimaryIndex : 0) ? 1 : 0;
      image.sort_order = index + 1;
    });
  }

  return images;
}

function formatNumber(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function productFromRow(row, imagesByProductId, currentRate = null) {
  if (!row) return null;

  const productId = Number(row.id);
  const images = imagesByProductId.get(productId) || [];

  const primaryImage =
    row.primary_image ||
    images.find((image) => image.is_primary === true)?.image_url ||
    images[0]?.image_url ||
    "";

  // ⭐ قیمت نمایشی - اصلاح شده با currentRate
  let displayPrice = null;
  const priceType = row.price_type || 'fixed';
  
  if (priceType === 'rate_based') {
    // برای محصولات وابسته به نرخ، calculated_price را نشان بده
    if (row.calculated_price !== null && row.calculated_price !== undefined) {
      displayPrice = Number(row.calculated_price);
    } else if (row.base_price !== null && row.base_price !== undefined && row.base_price > 0) {
      // ⭐ استفاده از نرخ واقعی به جای Hard Code
      const rate = currentRate || 196000;
      displayPrice = Number(row.base_price) * rate;
    }
  } else {
    // محصول ثابت
    if (row.price !== null && row.price !== undefined) {
      displayPrice = Number(row.price);
    }
  }

  return {
    id: productId,
    slug: row.slug || "",
    name: row.name || "",
    category: row.category || "",
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    price_label: row.price_label || "تماس بگیرید",
    show_price: Number(row.show_price) === 1,
    stock_quantity: Math.max(0, Number(row.stock_quantity || 0)),
    in_stock: Number(row.in_stock) === 1,
    stock_label: row.stock_label || "",
    short_description: row.short_description || "",
    description: row.description || "",
    primary_image: primaryImage,
    page_url: row.page_url || "",
    status: row.status || "draft",
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    images,
    // ⭐ فیلدهای جدید سیستم نرخ ارز
    price_type: row.price_type || 'fixed',
    base_price: row.base_price === null || row.base_price === undefined ? null : Number(row.base_price),
    profit_type: row.profit_type || 'none',
    profit_value: row.profit_value === null || row.profit_value === undefined ? null : Number(row.profit_value),
    fixed_fee: row.fixed_fee === null || row.fixed_fee === undefined ? null : Number(row.fixed_fee),
    rounding_type: row.rounding_type || 'none',
    rounding_method: row.rounding_method || 'nearest',
    calculated_price: row.calculated_price === null || row.calculated_price === undefined ? null : Number(row.calculated_price),
    price_calculated_at: row.price_calculated_at || null,
    display_price: displayPrice,
    display_price_formatted: displayPrice !== null ? `${formatNumber(displayPrice)} تومان` : "تماس بگیرید"
  };
}

async function getProductImages(db, productIds) {
  const imagesByProductId = new Map();

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return imagesByProductId;
  }

  const ids = [...new Set(productIds.map(toPositiveId).filter(Boolean))];

  if (ids.length === 0) {
    return imagesByProductId;
  }

  const placeholders = ids.map(() => "?").join(", ");

  const result = await db
    .prepare(`
      SELECT
        id,
        product_id,
        image_url,
        alt_text,
        sort_order,
        is_primary,
        created_at
      FROM product_images
      WHERE product_id IN (${placeholders})
      ORDER BY product_id ASC, is_primary DESC, sort_order ASC, id ASC
    `)
    .bind(...ids)
    .all();

  for (const row of result.results || []) {
    const productId = Number(row.product_id);

    if (!imagesByProductId.has(productId)) {
      imagesByProductId.set(productId, []);
    }

    imagesByProductId.get(productId).push({
      id: Number(row.id),
      image_url: row.image_url || "",
      alt_text: row.alt_text || "",
      sort_order: Number(row.sort_order || 0),
      is_primary: Number(row.is_primary) === 1,
      created_at: row.created_at || null
    });
  }

  return imagesByProductId;
}

async function getProductRow(db, productId) {
  return db
    .prepare(`
      SELECT
        id,
        slug,
        name,
        category,
        price,
        price_label,
        show_price,
        stock_quantity,
        in_stock,
        stock_label,
        short_description,
        description,
        primary_image,
        page_url,
        status,
        created_at,
        updated_at,
        -- ⭐ فیلدهای جدید سیستم نرخ ارز
        price_type,
        base_price,
        profit_type,
        profit_value,
        fixed_fee,
        rounding_type,
        rounding_method,
        calculated_price,
        price_calculated_at
      FROM products
      WHERE id = ?
      LIMIT 1
    `)
    .bind(productId)
    .first();
}

async function getProductPayload(db, productId) {
  const row = await getProductRow(db, productId);

  if (!row) return null;

  const imagesByProductId = await getProductImages(db, [productId]);

  return productFromRow(row, imagesByProductId);
}

function getProductInput(body) {
  const name = cleanText(body?.name, 250);
  const slug = cleanSlug(body?.slug || name);

  const category = cleanText(body?.category, 120);
  const price = toOptionalPrice(body?.price);
  const priceLabel =
    cleanText(body?.price_label ?? body?.priceLabel, 100) || "تماس بگیرید";

  const showPrice = toBooleanInteger(
    body?.show_price ?? body?.showPrice,
    price !== null
  );

  const stockQuantity = Math.max(
    0,
    toInteger(body?.stock_quantity ?? body?.stockQuantity, 0)
  );

  const inStock = toBooleanInteger(
    body?.in_stock ?? body?.inStock,
    stockQuantity > 0
  );

  const stockLabel =
    cleanText(body?.stock_label ?? body?.stockLabel, 100) ||
    (inStock ? "موجود" : "ناموجود");

  const shortDescription = cleanText(
    body?.short_description ?? body?.shortDescription,
    1000
  );

  const description = cleanText(body?.description, 20000);
  const pageUrl = cleanText(body?.page_url ?? body?.pageUrl, 500);
  const status = normalizeStatus(body?.status);
  const images = normalizeImages(body?.images);

  const requestedPrimary = normalizeImageUrl(
    body?.primary_image ?? body?.primaryImage
  );

  const primaryImage =
    requestedPrimary ||
    images.find((image) => image.is_primary === 1)?.image_url ||
    images[0]?.image_url ||
    "";

  if (images.length > 0 && primaryImage) {
    const requestedIndex = images.findIndex(
      (image) => image.image_url === primaryImage
    );

    if (requestedIndex >= 0) {
      images.forEach((image, index) => {
        image.is_primary = index === requestedIndex ? 1 : 0;
        image.sort_order = index + 1;
      });
    }
  }

  // ⭐ فیلدهای جدید سیستم نرخ ارز
  const priceType = body?.price_type ?? body?.priceType ?? 'fixed';
  const basePrice = toOptionalPrice(body?.base_price ?? body?.basePrice);
  const profitType = body?.profit_type ?? body?.profitType ?? 'none';
  const profitValue = toOptionalPrice(body?.profit_value ?? body?.profitValue);
  const fixedFee = toOptionalPrice(body?.fixed_fee ?? body?.fixedFee);
  const roundingType = body?.rounding_type ?? body?.roundingType ?? 'none';
  const roundingMethod = body?.rounding_method ?? body?.roundingMethod ?? 'nearest';

  return {
    name,
    slug,
    category,
    price,
    priceLabel,
    showPrice,
    stockQuantity,
    inStock,
    stockLabel,
    shortDescription,
    description,
    pageUrl,
    status,
    primaryImage,
    images,
    // ⭐ فیلدهای جدید
    priceType,
    basePrice,
    profitType,
    profitValue,
    fixedFee,
    roundingType,
    roundingMethod
  };
}

async function replaceProductImages(db, productId, images, defaultAltText) {
  await db
    .prepare("DELETE FROM product_images WHERE product_id = ?")
    .bind(productId)
    .run();

  if (!images.length) return;

  const statements = images.map((image, index) =>
    db
      .prepare(`
        INSERT INTO product_images (
          product_id,
          image_url,
          alt_text,
          sort_order,
          is_primary
        )
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(
        productId,
        image.image_url,
        image.alt_text || defaultAltText || "",
        index + 1,
        image.is_primary === 1 ? 1 : 0
      )
  );

  await db.batch(statements);
}

// ⭐ تابع محاسبه و ذخیره قیمت محاسبه‌شده محصول
async function calculateAndSaveProductPrice(db, productId, rate) {
  const product = await db
    .prepare(`
      SELECT 
        id,
        price_type,
        base_price,
        profit_type,
        profit_value,
        fixed_fee,
        rounding_type,
        rounding_method
      FROM products
      WHERE id = ?
    `)
    .bind(productId)
    .first();

  if (!product) return null;
  if (product.price_type !== 'rate_based') return null;
  if (!product.base_price || product.base_price <= 0) return null;

  const calculatedPrice = calculateProductPrice(product, rate);

  await db
    .prepare(`
      UPDATE products
      SET 
        calculated_price = ?,
        price_calculated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(calculatedPrice, productId)
    .run();

  return calculatedPrice;
}

export async function onRequestGet(context) {
  try {
    const adminCheck = await requireAdmin(context);

    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    // ⭐ دریافت نرخ فعلی دلار برای نمایش صحیح قیمت‌ها
    let currentRate = null;
    try {
      const rateResult = await getCurrentRate(context.env, 'USD');
      if (rateResult) {
        currentRate = rateResult.rate;
      }
    } catch (_) {
      currentRate = 196000; // fallback
    }

    const url = new URL(context.request.url);
    const search = cleanText(url.searchParams.get("search"), 160);
    const status = cleanText(url.searchParams.get("status"), 30).toLowerCase();
    const category = cleanText(url.searchParams.get("category"), 120);

    const page = Math.max(1, toInteger(url.searchParams.get("page"), 1));
    const limit = Math.min(
      100,
      Math.max(1, toInteger(url.searchParams.get("limit"), 100))
    );

    const offset = (page - 1) * limit;
    const filters = [];
    const bindings = [];

    if (search) {
      const like = `%${search}%`;
      filters.push("(name LIKE ? OR slug LIKE ? OR category LIKE ?)");
      bindings.push(like, like, like);
    }

    if (["published", "draft", "private"].includes(status)) {
      filters.push("status = ?");
      bindings.push(status);
    }

    if (category) {
      filters.push("category = ?");
      bindings.push(category);
    }

    const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const countRow = await context.env.DB
      .prepare(`
        SELECT COUNT(*) AS total
        FROM products
        ${whereSql}
      `)
      .bind(...bindings)
      .first();

    const productsResult = await context.env.DB
      .prepare(`
        SELECT
          id,
          slug,
          name,
          category,
          price,
          price_label,
          show_price,
          stock_quantity,
          in_stock,
          stock_label,
          short_description,
          description,
          primary_image,
          page_url,
          status,
          created_at,
          updated_at,
          -- ⭐ فیلدهای جدید سیستم نرخ ارز
          price_type,
          base_price,
          profit_type,
          profit_value,
          fixed_fee,
          rounding_type,
          rounding_method,
          calculated_price,
          price_calculated_at
        FROM products
        ${whereSql}
        ORDER BY updated_at DESC, id DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...bindings, limit, offset)
      .all();

    const rows = productsResult.results || [];

    const imagesByProductId = await getProductImages(
      context.env.DB,
      rows.map((row) => row.id)
    );

    const categoriesResult = await context.env.DB
      .prepare(`
        SELECT DISTINCT category
        FROM products
        WHERE category IS NOT NULL AND TRIM(category) != ''
        ORDER BY category COLLATE NOCASE ASC
      `)
      .all();

    const total = Number(countRow?.total || 0);

    // ⭐ ارسال currentRate به productFromRow
    return json({
      success: true,
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
      categories: (categoriesResult.results || [])
        .map((row) => row.category)
        .filter(Boolean),
      products: rows.map((row) => productFromRow(row, imagesByProductId, currentRate))
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: String(error?.message || error)
      },
      500
    );
  }
}

export async function onRequestPost(context) {
  try {
    const adminCheck = await requireAdmin(context);

    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const body = await context.request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return json({ success: false, error: "invalid_request_body" }, 400);
    }

    const input = getProductInput(body);

    if (!input.name) {
      return json(
        {
          success: false,
          error: "نام محصول الزامی است."
        },
        400
      );
    }

    if (!input.slug) {
      return json(
        {
          success: false,
          error:
            "slug محصول معتبر نیست. slug باید فقط شامل حروف انگلیسی، عدد و خط تیره باشد."
        },
        400
      );
    }

    // اعتبارسنجی برای محصولات وابسته به نرخ
    if (input.priceType === 'rate_based') {
      if (!input.basePrice || input.basePrice <= 0) {
        return json(
          {
            success: false,
            error: "برای محصولات وابسته به نرخ ارز، قیمت پایه به دلار الزامی است."
          },
          400
        );
      }
    }

    const existing = await context.env.DB
      .prepare("SELECT id FROM products WHERE slug = ? LIMIT 1")
      .bind(input.slug)
      .first();

    if (existing) {
      return json(
        {
          success: false,
          error: "این slug قبلاً برای یک محصول دیگر استفاده شده است."
        },
        409
      );
    }

    // ⭐ محاسبه قیمت اولیه برای محصولات وابسته به نرخ
    let calculatedPrice = null;
    if (input.priceType === 'rate_based' && input.basePrice) {
      try {
        const rate = await getCurrentRate(context.env, 'USD');
        if (rate) {
          const tempProduct = {
            price_type: input.priceType,
            base_price: input.basePrice,
            profit_type: input.profitType,
            profit_value: input.profitValue,
            fixed_fee: input.fixedFee,
            rounding_type: input.roundingType,
            rounding_method: input.roundingMethod
          };
          calculatedPrice = calculateProductPrice(tempProduct, rate.rate);
        }
      } catch (_) {}
    }

    const insertResult = await context.env.DB
      .prepare(`
        INSERT INTO products (
          slug,
          name,
          category,
          price,
          price_label,
          show_price,
          stock_quantity,
          in_stock,
          stock_label,
          short_description,
          description,
          primary_image,
          page_url,
          status,
          -- ⭐ فیلدهای جدید
          price_type,
          base_price,
          profit_type,
          profit_value,
          fixed_fee,
          rounding_type,
          rounding_method,
          calculated_price,
          price_calculated_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)
      .bind(
        input.slug,
        input.name,
        input.category || null,
        input.price,
        input.priceLabel,
        input.showPrice,
        input.stockQuantity,
        input.inStock,
        input.stockLabel,
        input.shortDescription || null,
        input.description || null,
        input.primaryImage || null,
        input.pageUrl || null,
        input.status,
        input.priceType,
        input.basePrice || null,
        input.profitType,
        input.profitValue || null,
        input.fixedFee || null,
        input.roundingType,
        input.roundingMethod,
        calculatedPrice
      )
      .run();

    const productId = Number(insertResult.meta?.last_row_id || 0);

    if (!productId) {
      return json(
        {
          success: false,
          error: "ثبت محصول ناموفق بود."
        },
        500
      );
    }

    await replaceProductImages(
      context.env.DB,
      productId,
      input.images,
      input.name
    );

    const product = await getProductPayload(context.env.DB, productId);

    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "product_created",
      target_type: "product",
      target_id: productId,
      description: `Created product: ${input.name} (${input.slug}) - Price type: ${input.priceType}`
    });

    return json(
      {
        success: true,
        message: "محصول با موفقیت ایجاد شد.",
        product
      },
      201
    );
  } catch (error) {
    return json(
      {
        success: false,
        error: String(error?.message || error)
      },
      500
    );
  }
}

export async function onRequestPut(context) {
  try {
    const adminCheck = await requireAdmin(context);

    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const body = await context.request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return json({ success: false, error: "invalid_request_body" }, 400);
    }

    const productId = toPositiveId(body.id ?? body.product_id ?? body.productId);

    if (!productId) {
      return json(
        {
          success: false,
          error: "شناسه محصول معتبر نیست."
        },
        400
      );
    }

    const currentProduct = await getProductRow(context.env.DB, productId);

    if (!currentProduct) {
      return json(
        {
          success: false,
          error: "محصول موردنظر پیدا نشد."
        },
        404
      );
    }

    const input = getProductInput(body);

    if (!input.name) {
      return json(
        {
          success: false,
          error: "نام محصول الزامی است."
        },
        400
      );
    }

    if (!input.slug) {
      return json(
        {
          success: false,
          error:
            "slug محصول معتبر نیست. slug باید فقط شامل حروف انگلیسی، عدد و خط تیره باشد."
        },
        400
      );
    }

    // اعتبارسنجی برای محصولات وابسته به نرخ
    if (input.priceType === 'rate_based') {
      if (!input.basePrice || input.basePrice <= 0) {
        return json(
          {
            success: false,
            error: "برای محصولات وابسته به نرخ ارز، قیمت پایه به دلار الزامی است."
          },
          400
        );
      }
    }

    const duplicate = await context.env.DB
      .prepare("SELECT id FROM products WHERE slug = ? AND id != ? LIMIT 1")
      .bind(input.slug, productId)
      .first();

    if (duplicate) {
      return json(
        {
          success: false,
          error: "این slug قبلاً برای محصول دیگری استفاده شده است."
        },
        409
      );
    }

    // ⭐ محاسبه قیمت برای محصولات وابسته به نرخ
    let calculatedPrice = null;
    if (input.priceType === 'rate_based' && input.basePrice) {
      try {
        const rate = await getCurrentRate(context.env, 'USD');
        if (rate) {
          const tempProduct = {
            price_type: input.priceType,
            base_price: input.basePrice,
            profit_type: input.profitType,
            profit_value: input.profitValue,
            fixed_fee: input.fixedFee,
            rounding_type: input.roundingType,
            rounding_method: input.roundingMethod
          };
          calculatedPrice = calculateProductPrice(tempProduct, rate.rate);
        }
      } catch (_) {}
    } else if (input.priceType === 'fixed') {
      // برای محصولات ثابت، calculated_price را null کن
      calculatedPrice = null;
    }

    await context.env.DB
      .prepare(`
        UPDATE products
        SET
          slug = ?,
          name = ?,
          category = ?,
          price = ?,
          price_label = ?,
          show_price = ?,
          stock_quantity = ?,
          in_stock = ?,
          stock_label = ?,
          short_description = ?,
          description = ?,
          primary_image = ?,
          page_url = ?,
          status = ?,
          -- ⭐ فیلدهای جدید
          price_type = ?,
          base_price = ?,
          profit_type = ?,
          profit_value = ?,
          fixed_fee = ?,
          rounding_type = ?,
          rounding_method = ?,
          calculated_price = ?,
          price_calculated_at = CASE 
            WHEN ? IS NOT NULL THEN CURRENT_TIMESTAMP 
            ELSE price_calculated_at 
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        input.slug,
        input.name,
        input.category || null,
        input.price,
        input.priceLabel,
        input.showPrice,
        input.stockQuantity,
        input.inStock,
        input.stockLabel,
        input.shortDescription || null,
        input.description || null,
        input.primaryImage || null,
        input.pageUrl || null,
        input.status,
        input.priceType,
        input.basePrice || null,
        input.profitType,
        input.profitValue || null,
        input.fixedFee || null,
        input.roundingType,
        input.roundingMethod,
        calculatedPrice,
        calculatedPrice,
        productId
      )
      .run();

    await replaceProductImages(
      context.env.DB,
      productId,
      input.images,
      input.name
    );

    const product = await getProductPayload(context.env.DB, productId);

    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "product_updated",
      target_type: "product",
      target_id: productId,
      description: `Updated product: ${input.name} (${input.slug}) - Price type: ${input.priceType}`
    });

    return json({
      success: true,
      message: "اطلاعات محصول با موفقیت ذخیره شد.",
      product
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: String(error?.message || error)
      },
      500
    );
  }
}

export async function onRequestDelete(context) {
  try {
    const adminCheck = await requireAdmin(context);

    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const url = new URL(context.request.url);
    let productId = toPositiveId(url.searchParams.get("id"));

    if (!productId) {
      const body = await context.request.json().catch(() => null);
      productId = toPositiveId(body?.id ?? body?.product_id ?? body?.productId);
    }

    if (!productId) {
      return json(
        {
          success: false,
          error: "شناسه محصول معتبر نیست."
        },
        400
      );
    }

    const product = await getProductRow(context.env.DB, productId);

    if (!product) {
      return json(
        {
          success: false,
          error: "محصول موردنظر پیدا نشد یا قبلاً حذف شده است."
        },
        404
      );
    }

    await context.env.DB.batch([
      context.env.DB
        .prepare("DELETE FROM product_images WHERE product_id = ?")
        .bind(productId),
      context.env.DB.prepare("DELETE FROM products WHERE id = ?").bind(productId)
    ]);

    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "product_deleted",
      target_type: "product",
      target_id: productId,
      description: `Deleted product: ${product.name} (${product.slug})`
    });

    return json({
      success: true,
      message: "محصول و گالری تصاویر آن با موفقیت حذف شد.",
      deleted_product: {
        id: Number(product.id),
        name: product.name,
        slug: product.slug
      }
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: String(error?.message || error)
      },
      500
    );
  }
}