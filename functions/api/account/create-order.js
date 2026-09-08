import { getCurrentUser } from "../../lib/admin";
import { getCurrentRate } from "../../lib/rate";
import {
  sendOrderCreatedNotification,
  sendUserOrderCreatedNotification
} from "../../lib/notification";

function json(data, status = 200) {
  return Response.json(data, { status });
}

function normalizeDigits(value) {
  const map = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9"
  };

  return String(value ?? "").replace(/[۰-۹]/g, (digit) => map[digit]);
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  const normalized = normalizeDigits(value).replace(/[^\d]/g, "");
  if (!normalized) return 0;

  const parsed = Number(normalized);
  return Number.isFinite(parsed)
    ? Math.max(0, Math.round(parsed))
    : 0;
}

function generateOrderNumber() {
  const now = new Date();

  const datePart = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0")
  ].join("");

  const randomPart = Math.floor(100000 + Math.random() * 900000);

  return `TT-${datePart}-${randomPart}`;
}

function validatePayload(body) {
  if (!body || typeof body !== "object") {
    return "payload-invalid";
  }

  const address = body.address || {};
  const order = body.order || {};
  const items = Array.isArray(order.items) ? order.items : [];

  if (
    !address.full_name ||
    !address.address_line ||
    !address.city ||
    !address.state
  ) {
    return "address-invalid";
  }

  if (!items.length) {
    return "items-empty";
  }

  if (
    !Number.isFinite(Number(order.total_amount)) ||
    Number(order.total_amount) <= 0
  ) {
    return "total-invalid";
  }

  return null;
}

function extractItemName(item) {
  return normalizeText(
    item?.product_name ||
    item?.name ||
    item?.title ||
    item?.product?.name ||
    "محصول"
  );
}

function extractItemQuantity(item) {
  const quantity = normalizeNumber(
    item?.qty ??
    item?.quantity ??
    item?.count ??
    item?.amount
  );

  return quantity > 0 ? quantity : 1;
}

function extractItemUnitPrice(item) {
  if (
    item?.displayPrice !== undefined &&
    item?.displayPrice !== null
  ) {
    const displayPrice = normalizeNumber(item.displayPrice);

    if (displayPrice > 0) {
      return displayPrice;
    }
  }

  const directPrice = normalizeNumber(item?.unit_price);

  if (directPrice > 0) {
    return directPrice;
  }

  const price = normalizeNumber(item?.price);

  if (price > 0) {
    return price;
  }

  const productPrice = normalizeNumber(item?.product?.price);

  if (productPrice > 0) {
    return productPrice;
  }

  const rowTotal = normalizeNumber(
    item?.row_total ??
    item?.total_price ??
    item?.total
  );

  const quantity = extractItemQuantity(item);

  if (rowTotal > 0 && quantity > 0) {
    return Math.round(rowTotal / quantity);
  }

  return 0;
}

function extractItemTotalPrice(item) {
  const directTotal = normalizeNumber(
    item?.row_total ??
    item?.total_price ??
    item?.line_total ??
    item?.total
  );

  if (directTotal > 0) {
    return directTotal;
  }

  const quantity = extractItemQuantity(item);
  const unitPrice = extractItemUnitPrice(item);

  return quantity * unitPrice;
}

function extractProductId(item) {
  const raw = item?.product_id ?? item?.product?.id ?? null;
  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : null;
}

function extractRateAtPurchase(item) {
  const rate = normalizeNumber(
    item?.rate_at_purchase ??
    item?.rateAtPurchase ??
    item?.rate
  );

  return rate > 0 ? rate : null;
}

function extractCurrencyCode(item) {
  return normalizeText(
    item?.currency_code ??
    item?.currencyCode ??
    "USD"
  ) || "USD";
}

function normalizeStatuses(rawValue) {
  if (!rawValue) {
    return ["completed"];
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (Array.isArray(parsed)) {
      const list = parsed
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean);

      return list.length
        ? list
        : ["completed"];
    }
  } catch (_) {}

  const list = String(rawValue)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return list.length
    ? list
    : ["completed"];
}

async function getCashbackSettings(db) {
  const defaults = {
    cashbackPercent: 0,
    cashbackStatuses: ["completed"]
  };

  try {
    const rows = await db.prepare(`
      SELECT setting_key, setting_value
      FROM app_settings
      WHERE setting_key IN (
        'cashback_percent',
        'cashback_statuses'
      )
    `).all();

    const results = Array.isArray(rows?.results)
      ? rows.results
      : [];

    if (!results.length) {
      return defaults;
    }

    const settingsMap = {};

    for (const row of results) {
      settingsMap[
        String(row?.setting_key || "").trim()
      ] = row?.setting_value;
    }

    let cashbackPercent = Math.max(
      0,
      Math.min(
        100,
        Number(settingsMap.cashback_percent || 0)
      )
    );

    if (!Number.isFinite(cashbackPercent)) {
      cashbackPercent = 0;
    }

    const cashbackStatuses = normalizeStatuses(
      settingsMap.cashback_statuses
    );

    return {
      cashbackPercent,
      cashbackStatuses
    };
  } catch (_) {
    return defaults;
  }
}

async function createOrUpdateAddress(context, user, address) {
  const fullName =
    normalizeText(address.full_name) ||
    normalizeText(user.full_name);

  const addressLine = normalizeText(address.address_line);

  const postalCode = normalizeDigits(
    address.postal_code
  ).replace(/[^\d]/g, "");

  const phone = normalizeDigits(
    address.phone || user.phone
  ).replace(/[^\d]/g, "");

  const city = normalizeText(address.city);
  const state = normalizeText(address.state);

  const existingAddress = await context.env.DB
    .prepare(`
      SELECT id
      FROM addresses
      WHERE user_id = ?
      ORDER BY is_default DESC, id DESC
      LIMIT 1
    `)
    .bind(user.id)
    .first();

  if (existingAddress?.id) {
    await context.env.DB
      .prepare(`
        UPDATE addresses
        SET
          type = 'shipping',
          full_name = ?,
          address_line = ?,
          postal_code = ?,
          phone = ?,
          city = ?,
          state = ?,
          is_default = 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND user_id = ?
      `)
      .bind(
        fullName,
        addressLine,
        postalCode,
        phone,
        city,
        state,
        existingAddress.id,
        user.id
      )
      .run();

    return {
      id: existingAddress.id,
      full_name: fullName,
      address_line: addressLine,
      postal_code: postalCode,
      phone,
      city,
      state
    };
  }

  await context.env.DB
    .prepare(`
      UPDATE addresses
      SET
        is_default = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `)
    .bind(user.id)
    .run();

  const addressInsert = await context.env.DB
    .prepare(`
      INSERT INTO addresses (
        user_id,
        type,
        full_name,
        address_line,
        postal_code,
        phone,
        city,
        state,
        is_default,
        created_at,
        updated_at
      )
      VALUES (
        ?,
        'shipping',
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `)
    .bind(
      user.id,
      fullName,
      addressLine,
      postalCode,
      phone,
      city,
      state
    )
    .run();

  return {
    id: addressInsert.meta?.last_row_id ?? null,
    full_name: fullName,
    address_line: addressLine,
    postal_code: postalCode,
    phone,
    city,
    state
  };
}

async function generateUniqueOrderNumber(db) {
  let orderNumber = generateOrderNumber();

  let existingOrder = await db
    .prepare(`
      SELECT id
      FROM orders
      WHERE order_number = ?
      LIMIT 1
    `)
    .bind(orderNumber)
    .first();

  while (existingOrder) {
    orderNumber = generateOrderNumber();

    existingOrder = await db
      .prepare(`
        SELECT id
        FROM orders
        WHERE order_number = ?
        LIMIT 1
      `)
      .bind(orderNumber)
      .first();
  }

  return orderNumber;
}

async function hasWalletUseTransaction(db, userId, orderId) {
  const row = await db
    .prepare(`
      SELECT id
      FROM wallet_transactions
      WHERE user_id = ?
        AND order_id = ?
        AND type = 'debit'
        AND source = 'checkout'
        AND status = 'completed'
      LIMIT 1
    `)
    .bind(userId, orderId)
    .first();

  return !!row;
}

// ============================================
// بررسی و آماده‌سازی موجودی محصولات
// ============================================
async function validateProductStock(db, normalizedItems) {
  const requestedQuantities = new Map();

  for (const item of normalizedItems) {
    const productId = Number(item.product_id);
    const quantity = Math.max(1, Number(item.quantity) || 1);

    if (!productId) {
      return {
        success: false,
        error: "product_id_missing",
        product_name: item.product_name
      };
    }

    const previousQuantity =
      requestedQuantities.get(productId) || 0;

    requestedQuantities.set(
      productId,
      previousQuantity + quantity
    );
  }

  for (const [productId, requestedQuantity] of requestedQuantities) {
    const product = await db
      .prepare(`
        SELECT
          id,
          name,
          COALESCE(stock_quantity, 0) AS stock_quantity,
          COALESCE(in_stock, 0) AS in_stock,
          status
        FROM products
        WHERE id = ?
        LIMIT 1
      `)
      .bind(productId)
      .first();

    if (!product) {
      return {
        success: false,
        error: "product_not_found",
        product_id: productId
      };
    }

    const availableQuantity = Math.max(
      0,
      Number.parseInt(product.stock_quantity, 10) || 0
    );

    const isPublished =
      String(product.status || "").toLowerCase() === "published";

    const isInStock =
      Number(product.in_stock) === 1 &&
      availableQuantity > 0;

    if (!isPublished || !isInStock) {
      return {
        success: false,
        error: "product_out_of_stock",
        product_id: productId,
        product_name: product.name || "",
        available_quantity: availableQuantity,
        requested_quantity: requestedQuantity
      };
    }

    if (availableQuantity < requestedQuantity) {
      return {
        success: false,
        error: "insufficient_stock",
        product_id: productId,
        product_name: product.name || "",
        available_quantity: availableQuantity,
        requested_quantity: requestedQuantity
      };
    }
  }

  return {
    success: true,
    requestedQuantities
  };
}

// ============================================
// کم کردن موجودی محصولات
// ============================================
async function decreaseProductStock(db, requestedQuantities) {
  const updatedProducts = [];

  for (const [productId, quantity] of requestedQuantities) {
    const updateResult = await db
      .prepare(`
        UPDATE products
        SET
          stock_quantity = stock_quantity - ?,
          in_stock = CASE
            WHEN stock_quantity - ? > 0 THEN 1
            ELSE 0
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status = 'published'
          AND in_stock = 1
          AND stock_quantity >= ?
      `)
      .bind(
        quantity,
        quantity,
        productId,
        quantity
      )
      .run();

    const changes = Number(
      updateResult?.meta?.changes || 0
    );

    if (changes !== 1) {
      return {
        success: false,
        error: "stock_update_failed",
        product_id: productId
      };
    }

    const updatedProduct = await db
      .prepare(`
        SELECT
          id,
          name,
          COALESCE(stock_quantity, 0) AS stock_quantity,
          COALESCE(in_stock, 0) AS in_stock
        FROM products
        WHERE id = ?
        LIMIT 1
      `)
      .bind(productId)
      .first();

    updatedProducts.push({
      product_id: productId,
      product_name: updatedProduct?.name || "",
      purchased_quantity: quantity,
      remaining_quantity: Math.max(
        0,
        Number(updatedProduct?.stock_quantity) || 0
      ),
      in_stock: Number(updatedProduct?.in_stock) === 1
    });
  }

  return {
    success: true,
    products: updatedProducts
  };
}

// ============================================
// POST - ایجاد سفارش جدید
// ============================================
export async function onRequestPost(context) {
  try {
    const user = await getCurrentUser(context);

    if (!user) {
      return json(
        {
          success: false,
          error: "unauthorized"
        },
        401
      );
    }

    const body = await context.request
      .json()
      .catch(() => null);

    const validationError = validatePayload(body);

    if (validationError) {
      return json(
        {
          success: false,
          error: validationError
        },
        400
      );
    }

    let currentRate = null;

    try {
      const rateResult = await getCurrentRate(
        context.env,
        "USD"
      );

      if (rateResult) {
        currentRate = rateResult.rate;
      }
    } catch (_) {
      currentRate = 196000;
    }

    const address = body.address || {};
    const order = body.order || {};

    const items = Array.isArray(order.items)
      ? order.items
      : [];

    const shippingAmount = normalizeNumber(
      order.shipping_amount
    );

    const submittedSubtotalAmount = normalizeNumber(
      order.subtotal_amount
    );

    const submittedTotalAmount = normalizeNumber(
      order.total_amount
    );

    let recalculatedSubtotal = 0;

    const normalizedItems = items.map((item) => {
      const productId = extractProductId(item);
      const productName = extractItemName(item);
      const quantity = extractItemQuantity(item);
      const unitPrice = extractItemUnitPrice(item);
      const totalPrice = extractItemTotalPrice(item);
      const rateAtPurchase =
        extractRateAtPurchase(item) || currentRate;

      const currencyCode =
        extractCurrencyCode(item);

      recalculatedSubtotal += totalPrice;

      return {
        product_id: productId,
        product_name: productName,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        rate_at_purchase: rateAtPurchase,
        currency_code: currencyCode
      };
    });

    const subtotalAmount =
      recalculatedSubtotal > 0
        ? recalculatedSubtotal
        : submittedSubtotalAmount;

    const totalAmount =
      subtotalAmount + shippingAmount;

    if (
      submittedTotalAmount > 0 &&
      totalAmount !== submittedTotalAmount
    ) {
      return json(
        {
          success: false,
          error: "total-mismatch"
        },
        400
      );
    }

    // ============================================
    // بررسی موجودی قبل از ثبت سفارش
    // ============================================
    const stockValidation =
      await validateProductStock(
        context.env.DB,
        normalizedItems
      );

    if (!stockValidation.success) {
      return json(
        {
          success: false,
          error: stockValidation.error,
          product_id: stockValidation.product_id || null,
          product_name: stockValidation.product_name || "",
          available_quantity:
            stockValidation.available_quantity ?? null,
          requested_quantity:
            stockValidation.requested_quantity ?? null
        },
        400
      );
    }

    const requestedWalletUse = normalizeNumber(
      order.wallet_used_amount ??
      order.wallet_amount ??
      body.wallet_used_amount
    );

    const balanceBefore = normalizeNumber(
      user.wallet_balance
    );

    const maxWalletUsable = Math.min(
      balanceBefore,
      totalAmount
    );

    const walletUsedAmount = Math.min(
      requestedWalletUse,
      maxWalletUsable
    );

    const payableAmount = Math.max(
      0,
      totalAmount - walletUsedAmount
    );

    const { cashbackPercent } =
      await getCashbackSettings(context.env.DB);

    const cashbackBase = totalAmount;

    const cashbackAmount =
      cashbackBase > 0
        ? Math.round(
            (cashbackBase * cashbackPercent) / 100
          )
        : 0;

    const savedAddress =
      await createOrUpdateAddress(
        context,
        user,
        address
      );

    const orderNumber =
      await generateUniqueOrderNumber(
        context.env.DB
      );

    const orderInsert = await context.env.DB
      .prepare(`
        INSERT INTO orders (
          user_id,
          order_number,
          address_id,
          status,
          payment_status,
          subtotal_amount,
          shipping_amount,
          total_amount,
          wallet_used_amount,
          payable_amount,
          cashback_amount,
          cashback_status,
          notes,
          created_at,
          updated_at
        )
        VALUES (
          ?,
          ?,
          ?,
          'payment_pending',
          'pending',
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `)
      .bind(
        user.id,
        orderNumber,
        savedAddress.id,
        subtotalAmount,
        shippingAmount,
        totalAmount,
        walletUsedAmount,
        payableAmount,
        cashbackAmount,
        cashbackAmount > 0
          ? "pending"
          : "none",
        normalizeText(order.notes || body.notes)
      )
      .run();

    const orderId =
      orderInsert.meta?.last_row_id ?? null;

    if (!orderId) {
      return json(
        {
          success: false,
          error: "order-create-failed"
        },
        500
      );
    }

    // ============================================
    // ثبت آیتم‌های سفارش
    // ============================================
    for (const item of normalizedItems) {
      await context.env.DB
        .prepare(`
          INSERT INTO order_items (
            order_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total_price,
            rate_at_purchase,
            currency_code,
            created_at,
            updated_at
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `)
        .bind(
          orderId,
          item.product_id,
          item.product_name,
          item.quantity,
          item.unit_price,
          item.total_price,
          item.rate_at_purchase,
          item.currency_code
        )
        .run();
    }

    // ============================================
    // کم کردن موجودی محصولات
    // ============================================
    const stockUpdateResult =
      await decreaseProductStock(
        context.env.DB,
        stockValidation.requestedQuantities
      );

    if (!stockUpdateResult.success) {
      return json(
        {
          success: false,
          error: stockUpdateResult.error,
          product_id:
            stockUpdateResult.product_id || null
        },
        409
      );
    }

    // ============================================
    // استفاده از کیف پول
    // ============================================
    if (walletUsedAmount > 0) {
      const alreadyHasWalletTx =
        await hasWalletUseTransaction(
          context.env.DB,
          user.id,
          orderId
        );

      if (!alreadyHasWalletTx) {
        const balanceAfter = Math.max(
          0,
          balanceBefore - walletUsedAmount
        );

        await context.env.DB.batch([
          context.env.DB
            .prepare(`
              UPDATE users
              SET
                wallet_balance = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `)
            .bind(
              balanceAfter,
              user.id
            ),

          context.env.DB
            .prepare(`
              INSERT INTO wallet_transactions (
                user_id,
                type,
                amount,
                balance_before,
                balance_after,
                status,
                source,
                description,
                note,
                order_id,
                order_number,
                reference_type,
                reference_id,
                created_by_user_id,
                created_at,
                updated_at
              )
              VALUES (
                ?,
                'debit',
                ?,
                ?,
                ?,
                'completed',
                'checkout',
                ?,
                ?,
                ?,
                ?,
                'order',
                ?,
                ?,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              )
            `)
            .bind(
              user.id,
              walletUsedAmount,
              balanceBefore,
              balanceAfter,
              `برداشت کیف پول برای سفارش ${orderNumber}`,
              "استفاده از کیف پول در ثبت سفارش",
              orderId,
              orderNumber,
              String(orderId),
              user.id
            )
        ]);
      }
    }

    // ============================================
    // ارسال اعلان‌ها در پس‌زمینه
    // ============================================
    context.waitUntil(
      (async () => {
        try {
          let baseUrl = "";

          try {
            const urlResult =
              await context.env.DB
                .prepare(`
                  SELECT setting_value
                  FROM app_settings
                  WHERE setting_key = 'site_base_url'
                `)
                .first();

            if (urlResult) {
              baseUrl =
                urlResult.setting_value || "";
            }
          } catch (_) {
            baseUrl = "";
          }

          if (!baseUrl) {
            const requestUrl = new URL(
              context.request.url
            );

            baseUrl =
              `${requestUrl.protocol}//${requestUrl.host}`;
          }

          const orderData = {
            orderId,
            orderNumber,
            totalAmount,
            shippingAmount,
            walletUsedAmount,
            payableAmount,
            cashbackAmount,
            status: "payment_pending",
            paymentStatus: "pending",
            createdAt: new Date().toISOString()
          };

          const userData = {
            id: user.id,
            fullName: user.full_name || "",
            email: user.email || "",
            phone: user.phone || ""
          };

          // ⭐ ارسال اعلان به کاربر (شامل Email)
          try {
            await sendUserOrderCreatedNotification(
              context.env,
              orderData,
              userData,
              normalizedItems,
              baseUrl
            );
          } catch (userError) {
            console.error(
              "خطا در ارسال اعلان کاربر:",
              userError
            );
          }

          // ⭐ ارسال اعلان به ادمین (شامل Email)
          try {
            await sendOrderCreatedNotification(
              context.env,
              orderData,
              userData,
              normalizedItems,
              baseUrl
            );
          } catch (adminError) {
            console.error(
              "خطا در ارسال اعلان ادمین:",
              adminError
            );
          }
        } catch (notificationError) {
          console.error(
            "خطا در ارسال اعلان:",
            notificationError
          );
        }
      })()
    );

    return json({
      success: true,
      order: {
        id: orderId,
        order_number: orderNumber,
        status: "payment_pending",
        payment_status: "pending",

        address_id: savedAddress.id,

        address: {
          full_name: savedAddress.full_name,
          address_line: savedAddress.address_line,
          postal_code: savedAddress.postal_code,
          phone: savedAddress.phone,
          city: savedAddress.city,
          state: savedAddress.state
        },

        subtotal_amount: subtotalAmount,
        shipping_amount: shippingAmount,
        total_amount: totalAmount,

        wallet_used_amount: walletUsedAmount,
        payable_amount: payableAmount,

        cashback_percent: cashbackPercent,
        cashback_base: cashbackBase,
        cashback_amount: cashbackAmount,

        cashback_status:
          cashbackAmount > 0
            ? "pending"
            : "none",

        items_count: normalizedItems.length,
        rate_at_purchase: currentRate,

        stock_updates:
          stockUpdateResult.products
      }
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: String(
          error?.message || error
        )
      },
      500
    );
  }
}