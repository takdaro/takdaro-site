// ============================================
// mobile/products/index.js
// لیست محصولات پنل مدیریت موبایل
// ============================================

import {
  getMobileUser,
  mobileUnauthorized
} from "../../../lib/mobile-auth";

import {
  getCurrentRate
} from "../../../lib/rate";

// ============================================
// Response helper
// ============================================

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}

// ============================================
// Helpers
// ============================================

function normalizeText(value) {
  return String(value ?? "").trim();
}

function toInteger(value, fallback = 0) {
  const parsed =
    Number.parseInt(
      String(value ?? ""),
      10
    );

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function normalizeNumber(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat(
    "fa-IR"
  ).format(value);
}

// ============================================
// Product images
// ============================================

async function getProductImages(
  db,
  productIds
) {
  const imagesByProductId =
    new Map();

  if (
    !Array.isArray(productIds) ||
    productIds.length === 0
  ) {
    return imagesByProductId;
  }

  const ids = [
    ...new Set(
      productIds
        .map((id) =>
          toInteger(id, 0)
        )
        .filter(Boolean)
    )
  ];

  if (ids.length === 0) {
    return imagesByProductId;
  }

  const placeholders =
    ids
      .map(() => "?")
      .join(", ");

  const result =
    await db
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
        WHERE product_id IN (
          ${placeholders}
        )
        ORDER BY
          product_id ASC,
          is_primary DESC,
          sort_order ASC,
          id ASC
      `)
      .bind(...ids)
      .all();

  for (
    const row of
      result?.results || []
  ) {
    const productId =
      Number(
        row.product_id
      );

    if (
      !imagesByProductId.has(
        productId
      )
    ) {
      imagesByProductId.set(
        productId,
        []
      );
    }

    imagesByProductId
      .get(productId)
      .push({
        id:
          Number(
            row.id || 0
          ),

        image_url:
          row.image_url ||
          "",

        alt_text:
          row.alt_text ||
          "",

        sort_order:
          Number(
            row.sort_order || 0
          ),

        is_primary:
          Number(
            row.is_primary
          ) === 1,

        created_at:
          row.created_at ||
          null
      });
  }

  return imagesByProductId;
}

// ============================================
// Convert product row
// ============================================

function productFromRow(
  row,
  imagesByProductId,
  currentRate
) {
  const productId =
    Number(
      row.id || 0
    );

  const images =
    imagesByProductId.get(
      productId
    ) || [];

  const primaryImage =
    row.primary_image ||
    images.find(
      (image) =>
        image.is_primary
    )?.image_url ||
    images[0]?.image_url ||
    "";

  const priceType =
    row.price_type ||
    "fixed";

  let displayPrice = null;

  if (
    priceType ===
    "rate_based"
  ) {
    if (
      row.calculated_price !==
        null &&
      row.calculated_price !==
        undefined
    ) {
      displayPrice =
        normalizeNumber(
          row.calculated_price
        );
    } else if (
      row.base_price !==
        null &&
      row.base_price !==
        undefined &&
      Number(row.base_price) >
        0 &&
      Number(currentRate) >
        0
    ) {
      displayPrice =
        Number(
          row.base_price
        ) *
        Number(
          currentRate
        );
    }
  } else if (
    row.price !== null &&
    row.price !== undefined
  ) {
    displayPrice =
      normalizeNumber(
        row.price
      );
  }

  return {
    id:
      productId,

    slug:
      row.slug ||
      "",

    name:
      row.name ||
      "",

    category:
      row.category ||
      "",

    price:
      row.price === null ||
      row.price === undefined
        ? null
        : normalizeNumber(
            row.price
          ),

    price_label:
      row.price_label ||
      "تماس بگیرید",

    show_price:
      Number(
        row.show_price
      ) === 1,

    stock_quantity:
      Math.max(
        0,
        normalizeNumber(
          row.stock_quantity
        )
      ),

    in_stock:
      Number(
        row.in_stock
      ) === 1,

    stock_label:
      row.stock_label ||
      "",

    short_description:
      row.short_description ||
      "",

    description:
      row.description ||
      "",

    primary_image:
      primaryImage,

    page_url:
      row.page_url ||
      "",

    status:
      row.status ||
      "draft",

    created_at:
      row.created_at ||
      null,

    updated_at:
      row.updated_at ||
      null,

    images,

    price_type:
      row.price_type ||
      "fixed",

    base_price:
      row.base_price ===
        null ||
      row.base_price ===
        undefined
        ? null
        : normalizeNumber(
            row.base_price
          ),

    profit_type:
      row.profit_type ||
      "none",

    profit_value:
      row.profit_value ===
        null ||
      row.profit_value ===
        undefined
        ? null
        : normalizeNumber(
            row.profit_value
          ),

    fixed_fee:
      row.fixed_fee ===
        null ||
      row.fixed_fee ===
        undefined
        ? null
        : normalizeNumber(
            row.fixed_fee
          ),

    rounding_type:
      row.rounding_type ||
      "none",

    rounding_method:
      row.rounding_method ||
      "nearest",

    calculated_price:
      row.calculated_price ===
        null ||
      row.calculated_price ===
        undefined
        ? null
        : normalizeNumber(
            row.calculated_price
          ),

    price_calculated_at:
      row.price_calculated_at ||
      null,

    display_price:
      displayPrice,

    display_price_formatted:
      displayPrice !== null
        ? `${formatNumber(
            displayPrice
          )} تومان`
        : "تماس بگیرید"
  };
}

// ============================================
// GET - دریافت لیست محصولات
// ============================================

export async function onRequestGet(
  context
) {
  try {
    // ==========================================
    // احراز هویت موبایل
    // ==========================================

    const auth =
      await getMobileUser(
        context
      );

    if (!auth.ok) {
      return mobileUnauthorized(
        auth.reason
      );
    }

    // ==========================================
    // Query parameters
    // ==========================================

    const url =
      new URL(
        context.request.url
      );

    const search =
      normalizeText(
        url.searchParams.get(
          "search"
        )
      );

    const status =
      normalizeText(
        url.searchParams.get(
          "status"
        )
      ).toLowerCase();

    const category =
      normalizeText(
        url.searchParams.get(
          "category"
        )
      );

    const page =
      Math.max(
        1,
        toInteger(
          url.searchParams.get(
            "page"
          ),
          1
        )
      );

    const limit =
      Math.min(
        100,
        Math.max(
          1,
          toInteger(
            url.searchParams.get(
              "limit"
            ),
            50
          )
        )
      );

    const offset =
      (page - 1) *
      limit;

    // ==========================================
    // Filters
    // ==========================================

    const filters = [];
    const bindings = [];

    if (search) {
      const like =
        `%${search}%`;

      filters.push(
        `(
          name LIKE ?
          OR slug LIKE ?
          OR category LIKE ?
        )`
      );

      bindings.push(
        like,
        like,
        like
      );
    }

    if (
      [
        "published",
        "draft",
        "private"
      ].includes(status)
    ) {
      filters.push(
        "status = ?"
      );

      bindings.push(
        status
      );
    }

    if (category) {
      filters.push(
        "category = ?"
      );

      bindings.push(
        category
      );
    }

    const whereSql =
      filters.length > 0
        ? `WHERE ${filters.join(
            " AND "
          )}`
        : "";

    // ==========================================
    // Current USD rate
    // ==========================================

    let currentRate =
      null;

    try {
      const rate =
        await getCurrentRate(
          context.env,
          "USD"
        );

      if (rate) {
        currentRate =
          Number(
            rate.rate
          );
      }
    } catch (_) {
      currentRate =
        null;
    }

    // ==========================================
    // Count
    // ==========================================

    const countRow =
      await context.env.DB
        .prepare(`
          SELECT
            COUNT(*) AS total
          FROM products
          ${whereSql}
        `)
        .bind(...bindings)
        .first();

    // ==========================================
    // Products
    // ==========================================

    const result =
      await context.env.DB
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

          ORDER BY
            updated_at DESC,
            id DESC

          LIMIT ?
          OFFSET ?
        `)
        .bind(
          ...bindings,
          limit,
          offset
        )
        .all();

    const rows =
      Array.isArray(
        result?.results
      )
        ? result.results
        : [];

    // ==========================================
    // Images
    // ==========================================

    const imagesByProductId =
      await getProductImages(
        context.env.DB,
        rows.map(
          (row) =>
            row.id
        )
      );

    // ==========================================
    // Categories
    // ==========================================

    const categoriesResult =
      await context.env.DB
        .prepare(`
          SELECT DISTINCT
            category
          FROM products
          WHERE
            category IS NOT NULL
            AND TRIM(category) != ''
          ORDER BY
            category COLLATE NOCASE ASC
        `)
        .all();

    const categories =
      (
        categoriesResult
          ?.results || []
      )
        .map(
          (row) =>
            row.category
        )
        .filter(Boolean);

    // ==========================================
    // Response
    // ==========================================

    const total =
      Number(
        countRow?.total || 0
      );

    const products =
      rows.map(
        (row) =>
          productFromRow(
            row,
            imagesByProductId,
            currentRate
          )
      );

    return json({
      success: true,

      page,

      limit,

      total,

      total_pages:
        Math.max(
          1,
          Math.ceil(
            total / limit
          )
        ),

      current_rate:
        currentRate,

      categories,

      products
    });
  } catch (error) {
    console.error(
      "Mobile products error:",
      error
    );

    return json(
      {
        success: false,
        error:
          String(
            error?.message ||
              error
          )
      },
      500
    );
  }
}