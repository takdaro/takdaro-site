function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}

async function getCurrentUser(context) {
  const cookieString = context.request.headers.get("Cookie") || "";
  const sessionId = getCookie(cookieString, "session_id");

  if (!sessionId) return null;

  return await context.env.DB
    .prepare(`
      SELECT
        id,
        full_name,
        email,
        phone,
        role,
        COALESCE(wallet_balance, 0) AS wallet_balance
      FROM users
      WHERE id = (
        SELECT user_id
        FROM sessions
        WHERE id = ?
        LIMIT 1
      )
      LIMIT 1
    `)
    .bind(sessionId)
    .first();
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
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
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

  if (!address.full_name || !address.address_line || !address.city || !address.state) {
    return "address-invalid";
  }

  if (!items.length) {
    return "items-empty";
  }

  if (!Number.isFinite(Number(order.total_amount)) || Number(order.total_amount) <= 0) {
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
  const directPrice = normalizeNumber(item?.unit_price);
  if (directPrice > 0) return directPrice;

  const price = normalizeNumber(item?.price);
  if (price > 0) return price;

  const productPrice = normalizeNumber(item?.product?.price);
  if (productPrice > 0) return productPrice;

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

  if (directTotal > 0) return directTotal;

  const quantity = extractItemQuantity(item);
  const unitPrice = extractItemUnitPrice(item);
  return quantity * unitPrice;
}

async function getSetting(db, key, fallback = null) {
  try {
    const row = await db
      .prepare(`SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1`)
      .bind(key)
      .first();
    return row ? row.setting_value : fallback;
  } catch (_) {
    return fallback;
  }
}

export async function onRequestPost(context) {
  try {
    const user = await getCurrentUser(context);

    if (!user) {
      return Response.json(
        { success: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const body = await context.request.json();
    const validationError = validatePayload(body);

    if (validationError) {
      return Response.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    const address = body.address || {};
    const order = body.order || {};
    const items = Array.isArray(order.items) ? order.items : [];

    const fullName = normalizeText(address.full_name);
    const addressLine = normalizeText(address.address_line);
    const postalCode = normalizeDigits(address.postal_code).replace(/[^\d]/g, "");
    const phone = normalizeDigits(address.phone).replace(/[^\d]/g, "");
    const city = normalizeText(address.city);
    const state = normalizeText(address.state);

    const shippingAmount = normalizeNumber(order.shipping_amount);
    const subtotalAmount = normalizeNumber(order.subtotal_amount);
    const totalAmount = normalizeNumber(order.total_amount);

    const requestedWalletUse = normalizeNumber(
      order.wallet_used_amount ??
      order.wallet_amount ??
      body.wallet_used_amount
    );

    const balanceBefore = normalizeNumber(user.wallet_balance);
    const maxWalletUsable = Math.min(balanceBefore, totalAmount);
    const walletUsedAmount = Math.min(requestedWalletUse, maxWalletUsable);
    const walletApplied = walletUsedAmount > 0 ? 1 : 0;

    const finalPayableAmount = Math.max(0, totalAmount - walletUsedAmount);

    const cashbackPercent = Math.max(
      0,
      Math.min(
        100,
        Number(await getSetting(context.env.DB, "cashback_percent", "0")) || 0
      )
    );

    const cashbackAmount = finalPayableAmount > 0
      ? Math.round((finalPayableAmount * cashbackPercent) / 100)
      : 0;

    let orderNumber = generateOrderNumber();
    let existingOrder = await context.env.DB
      .prepare("SELECT id FROM orders WHERE order_number = ?")
      .bind(orderNumber)
      .first();

    while (existingOrder) {
      orderNumber = generateOrderNumber();
      existingOrder = await context.env.DB
        .prepare("SELECT id FROM orders WHERE order_number = ?")
        .bind(orderNumber)
        .first();
    }

    const existingShippingAddress = await context.env.DB
      .prepare(`
        SELECT id
        FROM addresses
        WHERE user_id = ? AND type = 'shipping'
        ORDER BY is_default DESC, created_at DESC
        LIMIT 1
      `)
      .bind(user.id)
      .first();

    let addressId = null;

    if (existingShippingAddress?.id) {
      await context.env.DB
        .prepare(`
          UPDATE addresses
          SET
            full_name = ?,
            address_line = ?,
            postal_code = ?,
            phone = ?,
            city = ?,
            state = ?,
            is_default = 1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `)
        .bind(
          fullName,
          addressLine,
          postalCode,
          phone,
          city,
          state,
          existingShippingAddress.id,
          user.id
        )
        .run();

      addressId = existingShippingAddress.id;
    } else {
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
          VALUES (?, 'shipping', ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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

      addressId = addressInsert.meta?.last_row_id ?? null;
    }

    const orderInsert = await context.env.DB
      .prepare(`
        INSERT INTO orders (
          user_id,
          order_number,
          status,
          total_amount,
          shipping_amount,
          discount_amount,
          payment_status,
          shipping_address_id,
          billing_address_id,
          wallet_used_amount,
          wallet_applied,
          cashback_amount,
          cashback_percent,
          cashback_status,
          created_at
        )
        VALUES (?, ?, 'pending', ?, ?, 0, 'pending', ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
      `)
      .bind(
        user.id,
        orderNumber,
        totalAmount,
        shippingAmount,
        addressId,
        addressId,
        walletUsedAmount,
        walletApplied,
        cashbackAmount,
        cashbackPercent
      )
      .run();

    const orderId = orderInsert.meta?.last_row_id ?? null;

    if (!orderId) {
      return Response.json(
        { success: false, error: "order-create-failed" },
        { status: 500 }
      );
    }

    for (const item of items) {
      const productName = extractItemName(item);
      const quantity = extractItemQuantity(item);
      const unitPrice = extractItemUnitPrice(item);
      const totalPrice = extractItemTotalPrice(item);

      await context.env.DB
        .prepare(`
          INSERT INTO order_items (
            order_id,
            product_name,
            quantity,
            unit_price,
            total_price,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `)
        .bind(
          orderId,
          productName,
          quantity,
          unitPrice,
          totalPrice
        )
        .run();
    }

    if (walletUsedAmount > 0) {
      const balanceAfter = balanceBefore - walletUsedAmount;

      await context.env.DB.batch([
        context.env.DB
          .prepare(`
            UPDATE users
            SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(balanceAfter, user.id),

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
              created_at
            )
            VALUES (?, 'debit', ?, ?, ?, 'completed', 'checkout', ?, ?, ?, ?, 'order', ?, CURRENT_TIMESTAMP)
          `)
          .bind(
            user.id,
            -walletUsedAmount,
            balanceBefore,
            balanceAfter,
            `برداشت از کیف پول برای سفارش ${orderNumber}`,
            `استفاده از کیف پول در مرحله ثبت سفارش`,
            orderId,
            orderNumber,
            String(orderId)
          )
      ]);
    }

    return Response.json({
      success: true,
      order: {
        id: orderId,
        order_number: orderNumber,
        status: "pending",
        payment_status: "pending",
        subtotal_amount: subtotalAmount,
        total_amount: totalAmount,
        shipping_amount: shippingAmount,
        wallet_used_amount: walletUsedAmount,
        wallet_applied: walletApplied,
        payable_amount: finalPayableAmount,
        cashback_amount: cashbackAmount,
        cashback_percent: cashbackPercent,
        cashback_status: "pending",
        shipping_address_id: addressId,
        billing_address_id: addressId,
        items_count: items.length
      }
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}