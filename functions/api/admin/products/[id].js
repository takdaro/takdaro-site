import { requireAdmin, logAdminAction } from "../../../lib/admin";

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
        typeof item === "string" ? "" : item?.alt_text ?? item?.altText,
        300
      ),
      sort_order: Math.max(
        0,
        toInteger(
          typeof item === "string" ? index + 1 : item?.sort_order ?? item?.sortOrder,
          index + 1
        )
      ),
      is_primary: toBooleanInteger(
        typeof item === "string" ? index === 0 : item?.is_primary ?? item?.isPrimary,
        index === 0
      )
    });
  }

  if (images.length > 0 && !images.some((image) => image.is_primary === 1)) {
    images[0].is_primary = 1;
  }

  return images;
}

function formatNumber(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function productFromRow(row, images) {
  const primaryImage =
    row.primary_image ||
    images.find((image) => image.is_primary === 1)?.image_url ||
    images[0]?.image_url ||
    "";

  // محاسبه قیمت نمایشی برای محصولات وابسته به نرخ
  let displayPrice = null;
  const priceType = row.price_type || 'fixed';
  
  if (priceType === 'rate_based') {
    // برای محصولات وابسته به نرخ، calculated_price را نشان بده
    if (row.calculated_price !== null && row.calculated_price !== undefined) {
      displayPrice = Number(row.calculated_price);
    } else if (row.base_price !== null && row.base_price !== undefined && row.base_price > 0) {
      // fallback: از نرخ پیش‌فرض 196000 استفاده کن
      const rate = 196000;
      displayPrice = Number(row.base_price) * rate;
    }
  } else {
    // محصول ثابت
    if (row.price !== null && row.price !== undefined) {
      displayPrice = Number(row.price);
    }
  }

  return {
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    category: row.category || "",
    price: row.price === null ? null : Number(row.price),
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

async function getProduct(context, productId) {
  const product = await context.env.DB
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

  if (!product) return null;

  const imagesResult = await context.env.DB
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
      WHERE product_id = ?
      ORDER BY is_primary DESC, sort_order ASC, id ASC
    `)
    .bind(productId)
    .all();

  const images = (imagesResult.results || []).map((image) => ({
    id: Number(image.id),
    image_url: image.image_url,
    alt_text: image.alt_text || "",
    sort_order: Number(image.sort_order || 0),
    is_primary: Number(image.is_primary) === 1,
    created_at: image.created_at || null
  }));

  return productFromRow(product, images);
}

function getProductId(context) {
  const productId = Number.parseInt(context.params?.id, 10);
  return Number.isInteger(productId) && productId > 0 ? productId : null;
}

export async function onRequestGet(context) {
  try {
    const adminCheck = await requireAdmin(context);

    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const productId = getProductId(context);

    if (!productId) {
      return json({ success: false, error: "invalid_product_id" }, 400);
    }

    const product = await getProduct(context, productId);

    if (!product) {
      return json({ success: false, error: "محصول پیدا نشد." }, 404);
    }

    return json({ success: true, product });
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

    const productId = getProductId(context);

    if (!productId) {
      return json({ success: false, error: "invalid_product_id" }, 400);
    }

    const currentProduct = await getProduct(context, productId);

    if (!currentProduct) {
      return json({ success: false, error: "محصول پیدا نشد." }, 404);
    }

    const body = await context.request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return json({ success: false, error: "invalid_request_body" }, 400);
    }

    const name = cleanText(body.name ?? currentProduct.name, 250);
    const slug = cleanSlug(body.slug ?? currentProduct.slug);

    if (!name) {
      return json({ success: false, error: "نام محصول الزامی است." }, 400);
    }

    if (!slug) {
      return json(
        {
          success: false,
          error: "slug محصول معتبر نیست."
        },
        400
      );
    }

    const duplicateSlug = await context.env.DB
      .prepare("SELECT id FROM products WHERE slug = ? AND id != ? LIMIT 1")
      .bind(slug, productId)
      .first();

    if (duplicateSlug) {
      return json(
        {
          success: false,
          error: "این slug قبلاً برای یک محصول دیگر استفاده شده است."
        },
        409
      );
    }

    const category = cleanText(body.category ?? currentProduct.category, 120);
    const price =
      Object.prototype.hasOwnProperty.call(body, "price")
        ? toOptionalPrice(body.price)
        : currentProduct.price;

    const priceLabel =
      cleanText(
        body.price_label ?? body.priceLabel ?? currentProduct.price_label,
        100
      ) || "تماس بگیرید";

    const showPrice = Object.prototype.hasOwnProperty.call(body, "show_price") ||
      Object.prototype.hasOwnProperty.call(body, "showPrice")
      ? toBooleanInteger(body.show_price ?? body.showPrice, price !== null)
      : currentProduct.show_price
        ? 1
        : 0;

    const stockQuantity = Object.prototype.hasOwnProperty.call(body, "stock_quantity") ||
      Object.prototype.hasOwnProperty.call(body, "stockQuantity")
      ? Math.max(0, toInteger(body.stock_quantity ?? body.stockQuantity, 0))
      : currentProduct.stock_quantity;

    const inStock = Object.prototype.hasOwnProperty.call(body, "in_stock") ||
      Object.prototype.hasOwnProperty.call(body, "inStock")
      ? toBooleanInteger(body.in_stock ?? body.inStock, stockQuantity > 0)
      : currentProduct.in_stock
        ? 1
        : 0;

    const stockLabel =
      cleanText(
        body.stock_label ?? body.stockLabel ?? currentProduct.stock_label,
        100
      ) || (inStock ? "موجود" : "ناموجود");

    const shortDescription = cleanText(
      body.short_description ??
        body.shortDescription ??
        currentProduct.short_description,
      1000
    );

    const description = cleanText(
      body.description ?? currentProduct.description,
      20000
    );

    const pageUrl = cleanText(
      body.page_url ?? body.pageUrl ?? currentProduct.page_url,
      500
    );

    const status = normalizeStatus(body.status ?? currentProduct.status);

    const shouldReplaceImages = Array.isArray(body.images);
    const images = shouldReplaceImages
      ? normalizeImages(body.images)
      : currentProduct.images.map((image, index) => ({
          image_url: image.image_url,
          alt_text: image.alt_text,
          sort_order: index + 1,
          is_primary: image.is_primary ? 1 : 0
        }));

    const primaryImage =
      normalizeImageUrl(
        body.primary_image ?? body.primaryImage ?? currentProduct.primary_image
      ) ||
      images.find((image) => image.is_primary === 1)?.image_url ||
      images[0]?.image_url ||
      "";

    // ⭐ دریافت فیلدهای جدید از body
    const priceType = body.price_type ?? body.priceType ?? currentProduct.price_type ?? 'fixed';
    const basePrice = Object.prototype.hasOwnProperty.call(body, "base_price") || Object.prototype.hasOwnProperty.call(body, "basePrice")
      ? toOptionalPrice(body.base_price ?? body.basePrice)
      : currentProduct.base_price;
    const profitType = body.profit_type ?? body.profitType ?? currentProduct.profit_type ?? 'none';
    const profitValue = Object.prototype.hasOwnProperty.call(body, "profit_value") || Object.prototype.hasOwnProperty.call(body, "profitValue")
      ? toOptionalPrice(body.profit_value ?? body.profitValue)
      : currentProduct.profit_value;
    const fixedFee = Object.prototype.hasOwnProperty.call(body, "fixed_fee") || Object.prototype.hasOwnProperty.call(body, "fixedFee")
      ? toOptionalPrice(body.fixed_fee ?? body.fixedFee)
      : currentProduct.fixed_fee;
    const roundingType = body.rounding_type ?? body.roundingType ?? currentProduct.rounding_type ?? 'none';
    const roundingMethod = body.rounding_method ?? body.roundingMethod ?? currentProduct.rounding_method ?? 'nearest';

    // ⭐ محاسبه قیمت برای محصولات وابسته به نرخ
    let calculatedPrice = null;
    if (priceType === 'rate_based' && basePrice && basePrice > 0) {
      try {
        // دریافت نرخ فعلی دلار
        const rateResult = await context.env.DB
          .prepare(`
            SELECT rate FROM rates WHERE currency_code = 'USD' AND is_active = 1 LIMIT 1
          `)
          .first();
        
        if (rateResult && rateResult.rate) {
          const tempProduct = {
            price_type: priceType,
            base_price: basePrice,
            profit_type: profitType,
            profit_value: profitValue,
            fixed_fee: fixedFee,
            rounding_type: roundingType,
            rounding_method: roundingMethod
          };
          // محاسبه قیمت با استفاده از تابع محاسبه
          const { calculateProductPrice } = await import("../../../lib/rate");
          calculatedPrice = calculateProductPrice(tempProduct, rateResult.rate);
        }
      } catch (_) {
        // اگر خطایی رخ داد، calculatedPrice را null بگذار
        calculatedPrice = null;
      }
    } else if (priceType === 'fixed') {
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
        slug,
        name,
        category || null,
        price,
        priceLabel,
        showPrice,
        stockQuantity,
        inStock,
        stockLabel,
        shortDescription || null,
        description || null,
        primaryImage || null,
        pageUrl || null,
        status,
        priceType,
        basePrice || null,
        profitType,
        profitValue || null,
        fixedFee || null,
        roundingType,
        roundingMethod,
        calculatedPrice,
        calculatedPrice,
        productId
      )
      .run();

    if (shouldReplaceImages) {
      await context.env.DB
        .prepare("DELETE FROM product_images WHERE product_id = ?")
        .bind(productId)
        .run();

      if (images.length > 0) {
        const imageStatements = images.map((image, index) =>
          context.env.DB
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
              image.alt_text || name,
              index + 1,
              index === 0 || image.is_primary === 1 ? 1 : 0
            )
        );

        await context.env.DB.batch(imageStatements);
      }
    }

    const updatedProduct = await getProduct(context, productId);

    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "product_updated",
      target_type: "product",
      target_id: productId,
      description: `Updated product: ${name} (${slug}) - Price type: ${priceType}`
    });

    return json({
      success: true,
      message: "محصول با موفقیت ویرایش شد.",
      product: updatedProduct
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

    const productId = getProductId(context);

    if (!productId) {
      return json({ success: false, error: "invalid_product_id" }, 400);
    }

    const product = await getProduct(context, productId);

    if (!product) {
      return json({ success: false, error: "محصول پیدا نشد." }, 404);
    }

    await context.env.DB
      .prepare("DELETE FROM product_images WHERE product_id = ?")
      .bind(productId)
      .run();

    await context.env.DB
      .prepare("DELETE FROM products WHERE id = ?")
      .bind(productId)
      .run();

    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "product_deleted",
      target_type: "product",
      target_id: productId,
      description: `Deleted product: ${product.name} (${product.slug})`
    });

    return json({
      success: true,
      message: "محصول با موفقیت حذف شد.",
      deleted_product: {
        id: productId,
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