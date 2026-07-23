function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

async function getCurrentUser(context) {
  const cookieString = context.request.headers.get("cookie") || "";
  const sessionId = getCookie(cookieString, "session_id");

  if (!sessionId) return null;

  return await context.env.DB.prepare(`
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
  `).bind(sessionId).first();
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
  if (!body || typeof body !== "object") return "payload-invalid";

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

function extractProductId(item) {
  const raw = item?.product_id ?? item?.product?.id ?? null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function getCashbackSettings(db) {
  try {
    const row = await db.prepare(`
      SELECT cashback_percent, cashback_statuses
      FROM wallet_settings
      ORDER BY id DESC
      LIMIT 1
    `).first();

    return {
      cashbackPercent: Math.max(0, Math.min(100, Number(row?.cashback_percent || 0))),
      cashbackStatuses: (() => {
        const raw = String(row?.cashback_statuses || "").trim();
        if (!raw) return ["completed"];

        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed
              .map((item) => String(item).trim().toLowerCase())
              .filter(Boolean);
          }
        } catch (_) {}

        return raw
          .split(",")
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean);
      })()
    };
  } catch (_) {
    return {
      cashbackPercent: 0,
      cashbackStatuses: ["completed"]
    };
  }
}

async function createOrUpdateAddress(context, user, address) {
  const fullName = normalizeText(address.full_name) || normalizeText(user.full_name);
  const addressLine = normalizeText(address.address_line);
  const postalCode = normalizeDigits(address.postal_code).replace(/[^\d]/g, "");
  const phone = normalizeDigits(address.phone || user.phone).replace(/[^\d]/g, "");
  const city = normalizeText(address.city);
  const state = normalizeText(address.state);

  const existingAddress = await context.env.DB.prepare(`
    SELECT id
    FROM user_addresses
    WHERE user_id = ?
    ORDER BY is_default DESC, id DESC
    LIMIT 1
  `).bind(user.id).first();

  if (existingAddress?.id) {
    await context.env.DB.prepare(`
      UPDATE user_addresses
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
      WHERE id = ? AND user_id = ?
    `).bind(
      fullName,
      addressLine,
      postalCode,
      phone,
      city,
      state,
      existingAddress.id,
      user.id
    ).run();

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

  const addressInsert = await context.env.DB.prepare(`
    INSERT INTO user_addresses (
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
  `).bind(
    user.id,
    fullName,
    addressLine,
    postalCode,
    phone,
    city,
    state
  ).run();

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
  let existingOrder = await db.prepare(`
    SELECT id
    FROM orders
    WHERE order_number = ?
    LIMIT 1
  `).bind(orderNumber).first();

  while (existingOrder) {
    orderNumber = generateOrderNumber();
    existingOrder = await db.prepare(`
      SELECT id
      FROM orders
      WHERE order_number = ?
      LIMIT 1
    `).bind(orderNumber).first();
  }

  return orderNumber;
}

export async function onRequestPost(context) {
  try {
    const user = await getCurrentUser(context);

    if (!user) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

    const body = await context.request.json().catch(() => null);
    const validationError = validatePayload(body);

    if (validationError) {
      return json({ success: false, error: validationError }, 400);
    }

    const address = body.address || {};
    const order = body.order || {};
    const items = Array.isArray(order.items) ? order.items : [];

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
    const payableAmount = Math.max(0, totalAmount - walletUsedAmount);

    const { cashbackPercent } = await getCashbackSettings(context.env.DB);

    // کش‌بک بهتر است روی مبلغ کالا حساب شود، نه مبلغ باقی‌مانده بعد از مصرف کیف پول
    const cashbackBase = subtotalAmount > 0 ? subtotalAmount : totalAmount;
    const cashbackAmount = cashbackBase > 0
      ? Math.round((cashbackBase * cashbackPercent) / 100)
      : 0;

    const savedAddress = await createOrUpdateAddress(context, user, address);
    const orderNumber = await generateUniqueOrderNumber(context.env.DB);

    const orderInsert = await context.env.DB.prepare(`
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
        cashback_amount,
        cashback_status,
        notes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      user.id,
      orderNumber,
      savedAddress.id,
      subtotalAmount,
      shippingAmount,
      totalAmount,
      walletUsedAmount,
      cashbackAmount,
      cashbackAmount > 0 ? "pending" : "none",
      normalizeText(order.notes || body.notes)
    ).run();

    const orderId = orderInsert.meta?.last_row_id ?? null;

    if (!orderId) {
      return json({ success: false, error: "order-create-failed" }, 500);
    }

    for (const item of items) {
      const productId = extractProductId(item);
      const productName = extractItemName(item);
      const quantity = extractItemQuantity(item);
      const unitPrice = extractItemUnitPrice(item);
      const totalPrice = extractItemTotalPrice(item);

      await context.env.DB.prepare(`
        INSERT INTO order_items (
          order_id,
          product_id,
          product_name,
          quantity,
          unit_price,
          total_price,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        orderId,
        productId,
        productName,
        quantity,
        unitPrice,
        totalPrice
      ).run();
    }

    if (walletUsedAmount > 0) {
      const balanceAfter = Math.max(0, balanceBefore - walletUsedAmount);

      await context.env.DB.batch([
        context.env.DB.prepare(`
          UPDATE users
          SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(balanceAfter, user.id),

        context.env.DB.prepare(`
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
          VALUES (?, 'debit', ?, ?, ?, 'completed', 'checkout', ?, ?, ?, ?, 'order', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(
          user.id,
          walletUsedAmount,
          balanceBefore,
          balanceAfter,
          `برداشت کیف پول برای سفارش ${orderNumber}`,
          `استفاده از کیف پول در ثبت سفارش`,
          orderId,
          orderNumber,
          String(orderId),
          user.id
        )
      ]);
    }

    return json({
      success: true,
      order: {
        id: orderId,
        order_number: orderNumber,
        status: "pending",
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
        cashback_status: cashbackAmount > 0 ? "pending" : "none",
        items_count: items.length
      }
    });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}