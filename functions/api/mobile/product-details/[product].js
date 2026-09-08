// ============================================
// mobile/product-details/[product].js
// جزئیات و ویرایش محصول برای پنل مدیریت موبایل
// ============================================

import {
  getMobileUser,
  mobileUnauthorized
} from "../../../lib/mobile-auth";

import {
  logAdminAction
} from "../../../lib/admin";

import {
  getCurrentRate,
  calculateProductPrice
} from "../../../lib/rate";

// ============================================
// Response
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

function cleanText(
  value,
  maxLength = 10000
) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function toPositiveId(value) {
  const number =
    Number.parseInt(
      String(value ?? ""),
      10
    );

  return Number.isFinite(number) &&
    number > 0
    ? number
    : 0;
}

function toInteger(
  value,
  fallback = 0
) {
  const number =
    Number.parseInt(
      String(value ?? ""),
      10
    );

  return Number.isFinite(number)
    ? number
    : fallback;
}

function toOptionalPrice(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const normalized =
    String(value)
      .replace(/[,\s]/g, "");

  const number =
    Number.parseInt(
      normalized,
      10
    );

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return null;
  }

  return number;
}

function toBooleanInteger(
  value,
  fallback = 0
) {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  const normalized =
    String(value ?? "")
      .trim()
      .toLowerCase();

  if (
    ["1", "true", "yes", "on"]
      .includes(normalized)
  ) {
    return 1;
  }

  if (
    ["0", "false", "no", "off"]
      .includes(normalized)
  ) {
    return 0;
  }

  return fallback ? 1 : 0;
}

function normalizeStatus(
  value,
  fallback = "draft"
) {
  const status =
    cleanText(
      value,
      30
    ).toLowerCase();

  if (
    [
      "published",
      "draft",
      "private"
    ].includes(status)
  ) {
    return status;
  }

  return fallback;
}

function normalizePriceType(
  value,
  fallback = "fixed"
) {
  const type =
    cleanText(
      value,
      30
    ).toLowerCase();

  if (
    [
      "fixed",
      "rate_based"
    ].includes(type)
  ) {
    return type;
  }

  return fallback;
}

function normalizeImageUrl(
  value
) {
  const url =
    cleanText(
      value,
      2000
    );

  if (!url) {
    return "";
  }

  if (
    url.startsWith("/") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }

  return `/${url.replace(
    /^\.?\//,
    ""
  )}`;
}

function normalizeImages(
  value,
  fallbackImages = []
) {
  const source =
    Array.isArray(value)
      ? value
      : fallbackImages;

  const seen =
    new Set();

  const images = [];

  for (
    let index = 0;
    index < source.length;
    index += 1
  ) {
    const item =
      source[index];

    const imageUrl =
      normalizeImageUrl(
        typeof item ===
          "string"
          ? item
          : item?.image_url ??
            item?.imageUrl ??
            item?.url
      );

    if (
      !imageUrl ||
      seen.has(imageUrl)
    ) {
      continue;
    }

    seen.add(imageUrl);

    images.push({
      image_url:
        imageUrl,

      alt_text:
        cleanText(
          typeof item ===
            "string"
            ? ""
            : item?.alt_text ??
              item?.altText,
          300
        ),

      sort_order:
        Math.max(
          1,
          toInteger(
            typeof item ===
              "string"
              ? index + 1
              : item?.sort_order ??
                item?.sortOrder,
            index + 1
          )
        ),

      is_primary:
        toBooleanInteger(
          typeof item ===
            "string"
            ? index === 0
            : item?.is_primary ??
              item?.isPrimary,
          index === 0
        )
    });
  }

  if (images.length > 0) {
    const primaryIndex =
      images.findIndex(
        (image) =>
          image.is_primary === 1
      );

    const finalPrimaryIndex =
      primaryIndex >= 0
        ? primaryIndex
        : 0;

    images.forEach(
      (
        image,
        index
      ) => {
        image.is_primary =
          index ===
          finalPrimaryIndex
            ? 1
            : 0;

        image.sort_order =
          index + 1;
      }
    );
  }

  return images;
}

// ============================================
// Find product
// ============================================

async function getProductByIdentifier(
  db,
  identifier
) {
  const value =
    String(
      identifier ?? ""
    ).trim();

  if (!value) {
    return null;
  }

  const productId =
    toPositiveId(
      value
    );

  if (productId > 0) {
    const byId =
      await db
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
          WHERE id = ?
          LIMIT 1
        `)
        .bind(productId)
        .first();

    if (byId) {
      return byId;
    }
  }

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
      WHERE slug = ?
      LIMIT 1
    `)
    .bind(value)
    .first();
}

// ============================================
// Product images
// ============================================

async function getProductImages(
  db,
  productId
) {
  const result =
    await db
      .prepare(`
        SELECT
          id,
          image_url,
          alt_text,
          sort_order,
          is_primary,
          created_at
        FROM product_images
        WHERE product_id = ?
        ORDER BY
          is_primary DESC,
          sort_order ASC,
          id ASC
      `)
      .bind(productId)
      .all();

  return Array.isArray(
    result?.results
  )
    ? result.results.map(
        (image) => ({
          id:
            Number(
              image.id || 0
            ),

          image_url:
            image.image_url ||
            "",

          alt_text:
            image.alt_text ||
            "",

          sort_order:
            Number(
              image.sort_order || 0
            ),

          is_primary:
            Number(
              image.is_primary
            ) === 1,

          created_at:
            image.created_at ||
            null
        })
      )
    : [];
}

// ============================================
// Product payload
// ============================================

async function getProductPayload(
  db,
  productId,
  currentRate = null
) {
  const row =
    await db
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
        WHERE id = ?
        LIMIT 1
      `)
      .bind(productId)
      .first();

  if (!row) {
    return null;
  }

  const images =
    await getProductImages(
      db,
      productId
    );

  let displayPrice =
    null;

  if (
    row.price_type ===
    "rate_based"
  ) {
    if (
      row.calculated_price !==
        null &&
      row.calculated_price !==
        undefined
    ) {
      displayPrice =
        Number(
          row.calculated_price
        );
    } else if (
      row.base_price !==
        null &&
      row.base_price !==
        undefined &&
      Number(
        row.base_price
      ) > 0 &&
      Number(
        currentRate || 0
      ) > 0
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
    row.price !==
      null &&
    row.price !==
      undefined
  ) {
    displayPrice =
      Number(
        row.price
      );
  }

  const primaryImage =
    row.primary_image ||
    images.find(
      (image) =>
        image.is_primary
    )?.image_url ||
    images[0]?.image_url ||
    "";

  return {
    id:
      Number(
        row.id || 0
      ),

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
        : Number(
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
        Number(
          row.stock_quantity ||
            0
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

    price_type:
      row.price_type ||
      "fixed",

    base_price:
      row.base_price ===
        null ||
      row.base_price ===
        undefined
        ? null
        : Number(
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
        : Number(
            row.profit_value
          ),

    fixed_fee:
      row.fixed_fee ===
        null ||
      row.fixed_fee ===
        undefined
        ? null
        : Number(
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
        : Number(
            row.calculated_price
          ),

    price_calculated_at:
      row.price_calculated_at ||
      null,

    display_price:
      displayPrice,

    display_price_formatted:
      displayPrice !== null
        ? `${new Intl.NumberFormat(
            "fa-IR"
          ).format(
            displayPrice
          )} تومان`
        : "تماس بگیرید",

    images
  };
}

// ============================================
// Replace images
// ============================================

async function replaceProductImages(
  db,
  productId,
  images,
  defaultAltText
) {
  await db
    .prepare(`
      DELETE FROM product_images
      WHERE product_id = ?
    `)
    .bind(productId)
    .run();

  if (!images.length) {
    return;
  }

  const statements =
    images.map(
      (
        image,
        index
      ) =>
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
            image.alt_text ||
              defaultAltText ||
              "",
            index + 1,
            image.is_primary ===
              1
              ? 1
              : 0
          )
    );

  await db.batch(
    statements
  );
}

// ============================================
// Calculate price
// ============================================

async function calculateAndSaveProductPrice(
  db,
  productId,
  rate
) {
  const product =
    await db
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
        LIMIT 1
      `)
      .bind(productId)
      .first();

  if (!product) {
    return null;
  }

  if (
    product.price_type !==
    "rate_based"
  ) {
    return null;
  }

  if (
    !product.base_price ||
    Number(
      product.base_price
    ) <= 0
  ) {
    return null;
  }

  const calculatedPrice =
    calculateProductPrice(
      product,
      rate
    );

  await db
    .prepare(`
      UPDATE products
      SET
        calculated_price = ?,
        price_calculated_at =
          CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(
      calculatedPrice,
      productId
    )
    .run();

  return calculatedPrice;
}

// ============================================
// GET
// ============================================

export async function onRequestGet(
  context
) {
  try {
    const auth =
      await getMobileUser(
        context
      );

    if (!auth.ok) {
      return mobileUnauthorized(
        auth.reason
      );
    }

    const identifier =
      decodeURIComponent(
        context.params?.product ||
          ""
      ).trim();

    if (!identifier) {
      return json(
        {
          success: false,
          error:
            "product_required"
        },
        400
      );
    }

    const product =
      await getProductByIdentifier(
        context.env.DB,
        identifier
      );

    if (!product) {
      return json(
        {
          success: false,
          error:
            "product_not_found"
        },
        404
      );
    }

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

    const payload =
      await getProductPayload(
        context.env.DB,
        product.id,
        currentRate
      );

    return json({
      success: true,
      current_rate:
        currentRate,
      product:
        payload
    });
  } catch (error) {
    console.error(
      "Mobile product details GET error:",
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

// ============================================
// PUT - ویرایش محصول
// ============================================

export async function onRequestPut(
  context
) {
  try {
    const auth =
      await getMobileUser(
        context
      );

    if (!auth.ok) {
      return mobileUnauthorized(
        auth.reason
      );
    }

    const identifier =
      decodeURIComponent(
        context.params?.product ||
          ""
      ).trim();

    if (!identifier) {
      return json(
        {
          success: false,
          error:
            "product_required"
        },
        400
      );
    }

    const currentProduct =
      await getProductByIdentifier(
        context.env.DB,
        identifier
      );

    if (!currentProduct) {
      return json(
        {
          success: false,
          error:
            "product_not_found"
        },
        404
      );
    }

    const body =
      await context.request
        .json()
        .catch(
          () => null
        );

    if (
      !body ||
      typeof body !==
        "object"
    ) {
      return json(
        {
          success: false,
          error:
            "invalid_request_body"
        },
        400
      );
    }

    const currentImages =
      await getProductImages(
        context.env.DB,
        currentProduct.id
      );

    // ==========================================
    // Merge old values with requested values
    // ==========================================

    const name =
      body.name !==
        undefined
        ? cleanText(
            body.name,
            250
          )
        : String(
            currentProduct.name ||
              ""
          );

    const slug =
      body.slug !==
        undefined
        ? cleanText(
            body.slug,
            160
          ).toLowerCase()
        : String(
            currentProduct.slug ||
              ""
          );

    const category =
      body.category !==
        undefined
        ? cleanText(
            body.category,
            120
          )
        : String(
            currentProduct.category ||
              ""
          );

    if (!name) {
      return json(
        {
          success: false,
          error:
            "name_required"
        },
        400
      );
    }

    if (!slug) {
      return json(
        {
          success: false,
          error:
            "slug_required"
        },
        400
      );
    }

    // ==========================================
    // Price
    // ==========================================

    const price =
      body.price !==
        undefined
        ? toOptionalPrice(
            body.price
          )
        : currentProduct.price ===
              null ||
          currentProduct.price ===
              undefined
          ? null
          : Number(
              currentProduct.price
            );

    const priceLabel =
      body.price_label !==
          undefined ||
      body.priceLabel !==
          undefined
        ? cleanText(
            body.price_label ??
              body.priceLabel,
            100
          ) ||
          "تماس بگیرید"
        : String(
            currentProduct.price_label ||
              "تماس بگیرید"
          );

    const showPrice =
      body.show_price !==
          undefined ||
      body.showPrice !==
          undefined
        ? toBooleanInteger(
            body.show_price ??
              body.showPrice,
            price !==
              null
          )
        : Number(
            currentProduct.show_price
          ) === 1;

    // ==========================================
    // Stock
    // ==========================================

    const stockQuantity =
      body.stock_quantity !==
          undefined ||
      body.stockQuantity !==
          undefined
        ? Math.max(
            0,
            toInteger(
              body.stock_quantity ??
                body.stockQuantity,
              0
            )
          )
        : Math.max(
            0,
            Number(
              currentProduct.stock_quantity ||
                0
            )
          );

    const inStock =
      body.in_stock !==
          undefined ||
      body.inStock !==
          undefined
        ? toBooleanInteger(
            body.in_stock ??
              body.inStock,
            stockQuantity > 0
          )
        : Number(
            currentProduct.in_stock
          ) === 1;

    const stockLabel =
      body.stock_label !==
          undefined ||
      body.stockLabel !==
          undefined
        ? cleanText(
            body.stock_label ??
              body.stockLabel,
            100
          ) ||
          (
            inStock
              ? "موجود"
              : "ناموجود"
          )
        : String(
            currentProduct.stock_label ||
              (
                inStock
                  ? "موجود"
                  : "ناموجود"
              )
          );

    // ==========================================
    // Descriptions
    // ==========================================

    const shortDescription =
      body.short_description !==
          undefined ||
      body.shortDescription !==
          undefined
        ? cleanText(
            body.short_description ??
              body.shortDescription,
            1000
          )
        : String(
            currentProduct.short_description ||
              ""
          );

    const description =
      body.description !==
        undefined
        ? cleanText(
            body.description,
            20000
          )
        : String(
            currentProduct.description ||
              ""
          );

    const pageUrl =
      body.page_url !==
          undefined ||
      body.pageUrl !==
          undefined
        ? cleanText(
            body.page_url ??
              body.pageUrl,
            500
          )
        : String(
            currentProduct.page_url ||
              ""
          );

    const status =
      body.status !==
        undefined
        ? normalizeStatus(
            body.status,
            String(
              currentProduct.status ||
                "draft"
            )
          )
        : String(
            currentProduct.status ||
              "draft"
          );

    // ==========================================
    // Price system
    // ==========================================

    const priceType =
      body.price_type !==
          undefined ||
      body.priceType !==
          undefined
        ? normalizePriceType(
            body.price_type ??
              body.priceType,
            String(
              currentProduct.price_type ||
                "fixed"
            )
          )
        : String(
            currentProduct.price_type ||
              "fixed"
          );

    const basePrice =
      body.base_price !==
          undefined ||
      body.basePrice !==
          undefined
        ? toOptionalPrice(
            body.base_price ??
              body.basePrice
          )
        : currentProduct.base_price ===
              null ||
          currentProduct.base_price ===
              undefined
          ? null
          : Number(
              currentProduct.base_price
            );

    const profitType =
      body.profit_type !==
          undefined ||
      body.profitType !==
          undefined
        ? cleanText(
            body.profit_type ??
              body.profitType,
            30
          )
        : String(
            currentProduct.profit_type ||
              "none"
          );

    const profitValue =
      body.profit_value !==
          undefined ||
      body.profitValue !==
          undefined
        ? toOptionalPrice(
            body.profit_value ??
              body.profitValue
          )
        : currentProduct.profit_value ===
              null ||
          currentProduct.profit_value ===
              undefined
          ? null
          : Number(
              currentProduct.profit_value
            );

    const fixedFee =
      body.fixed_fee !==
          undefined ||
      body.fixedFee !==
          undefined
        ? toOptionalPrice(
            body.fixed_fee ??
              body.fixedFee
          )
        : currentProduct.fixed_fee ===
              null ||
          currentProduct.fixed_fee ===
              undefined
          ? null
          : Number(
              currentProduct.fixed_fee
            );

    const roundingType =
      body.rounding_type !==
          undefined ||
      body.roundingType !==
          undefined
        ? cleanText(
            body.rounding_type ??
              body.roundingType,
            30
          )
        : String(
            currentProduct.rounding_type ||
              "none"
          );

    const roundingMethod =
      body.rounding_method !==
          undefined ||
      body.roundingMethod !==
          undefined
        ? cleanText(
            body.rounding_method ??
              body.roundingMethod,
            30
          )
        : String(
            currentProduct.rounding_method ||
              "nearest"
          );

    // ==========================================
    // Validate rate based product
    // ==========================================

    if (
      priceType ===
      "rate_based"
    ) {
      if (
        !basePrice ||
        basePrice <= 0
      ) {
        return json(
          {
            success: false,
            error:
              "base_price_required_for_rate_based_product"
          },
          400
        );
      }
    }

    // ==========================================
    // Calculate price
    // ==========================================

    let calculatedPrice =
      null;

    if (
      priceType ===
        "rate_based" &&
      basePrice
    ) {
      try {
        const rate =
          await getCurrentRate(
            context.env,
            "USD"
          );

        if (rate) {
          calculatedPrice =
            calculateProductPrice(
              {
                price_type:
                  priceType,
                base_price:
                  basePrice,
                profit_type:
                  profitType,
                profit_value:
                  profitValue,
                fixed_fee:
                  fixedFee,
                rounding_type:
                  roundingType,
                rounding_method:
                  roundingMethod
              },
              rate.rate
            );
        }
      } catch (_) {
        calculatedPrice =
          null;
      }
    }

    // ==========================================
    // Images
    // ==========================================

    const images =
      body.images !==
        undefined
        ? normalizeImages(
            body.images
          )
        : normalizeImages(
            currentImages
          );

    const primaryImage =
      body.primary_image !==
          undefined ||
      body.primaryImage !==
          undefined
        ? normalizeImageUrl(
            body.primary_image ??
              body.primaryImage
          )
        : (
            currentProduct.primary_image ||
            images.find(
              (
                image
              ) =>
                image.is_primary ===
                1
            )?.image_url ||
            images[0]?.image_url ||
            ""
          );

    // ==========================================
    // Update product
    // ==========================================

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
          price_type = ?,
          base_price = ?,
          profit_type = ?,
          profit_value = ?,
          fixed_fee = ?,
          rounding_type = ?,
          rounding_method = ?,
          calculated_price = ?,
          price_calculated_at =
            CASE
              WHEN ? IS NOT NULL
              THEN CURRENT_TIMESTAMP
              ELSE price_calculated_at
            END,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        slug,
        name,
        category ||
          null,
        price,
        priceLabel,
        showPrice,
        stockQuantity,
        inStock,
        stockLabel,
        shortDescription ||
          null,
        description ||
          null,
        primaryImage ||
          null,
        pageUrl ||
          null,
        status,
        priceType,
        basePrice,
        profitType,
        profitValue,
        fixedFee,
        roundingType,
        roundingMethod,
        calculatedPrice,
        calculatedPrice,
        currentProduct.id
      )
      .run();

    // ==========================================
    // Update images
    // ==========================================

    await replaceProductImages(
      context.env.DB,
      currentProduct.id,
      images,
      name
    );

    // ==========================================
    // Get current rate
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
    // Ensure calculated price is saved
    // ==========================================

    if (
      priceType ===
        "rate_based" &&
      !calculatedPrice &&
      currentRate
    ) {
      await calculateAndSaveProductPrice(
        context.env.DB,
        currentProduct.id,
        currentRate
      );
    }

    // ==========================================
    // Final product
    // ==========================================

    const product =
      await getProductPayload(
        context.env.DB,
        currentProduct.id,
        currentRate
      );

    // ==========================================
    // Admin log
    // ==========================================

    try {
      await logAdminAction(
        context,
        {
          admin_user_id:
            auth.user.id,

          action:
            "product_updated",

          target_type:
            "product",

          target_id:
            currentProduct.id,

          description:
            `Updated product from mobile admin: ${name} (${slug})`
        }
      );
    } catch (logError) {
      console.error(
        "Mobile product admin log error:",
        logError
      );
    }

    return json({
      success: true,

      message:
        "product_updated",

      product
    });
  } catch (error) {
    console.error(
      "Mobile product details PUT error:",
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