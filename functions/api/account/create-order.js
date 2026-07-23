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
    const settingsRows = await db.prepare(`
      SELECT key, value
      FROM site_settings
      WHERE key IN ('cashback_percent', 'cashback_statuses')
    `).all();

    const settingsList = Array.isArray(settingsRows?.results) ? settingsRows.results : [];
    const settingsMap = {};

    for (const row of settingsList) {
      settingsMap[String(row?.key || "").trim()] = row?.value;
    }

    let cashbackPercent = Math.max(0, Math.min(100, Number(settingsMap.cashback_percent || 0)));
    if (!Number.isFinite(cashbackPercent)) cashbackPercent = 0;

    const rawStatuses = String(settingsMap.cashback_statuses || "").trim();
    let cashbackStatuses = ["completed"];

    if (rawStatuses) {
      try {
        const parsed = JSON.parse(rawStatuses);
        if (Array.isArray(parsed)) {
          cashbackStatuses = parsed
            .map((item) => String(item || "").trim().toLowerCase())
            .filter(Boolean);
        } else {
          cashbackStatuses = rawStatuses
            .split(",")
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean);
        }
      } catch (_) {
        cashbackStatuses = rawStatuses
          .split(",")
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean);
      }
    }

    if (!cashbackStatuses.length) {
      cashbackStatuses = ["completed"];
    }

    return {
      cashbackPercent,
      cashbackStatuses
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

  await context.env.DB.prepare(`
    UPDATE user_addresses
    SET is_default = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).bind(user.id).run();

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

async function hasWalletUseTransaction(db, userId, orderId) {
  const row = await db.prepare(`
    SELECT id
    FROM wallet_transactions
    WHERE user_id = ?
      AND order_id = ?
      AND type = 'debit'
      AND source = 'checkout'
      AND status = 'completed'
    LIMIT 1
  `).bind(userId, orderId).first();

  return !!row;
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
    const submittedSubtotalAmount = normalizeNumber(order.subtotal_amount);
    const submittedTotalAmount = normalizeNumber(order.total_amount);

    let recalculatedSubtotal = 0;
    const normalizedItems = items.map((item) => {
      const productId = extractProductId(item);
      const productName = extractItemName(item);
      const quantity = extractItemQuantity(item);
      const unitPrice = extractItemUnitPrice(item);
      const totalPrice = extractItemTotalPrice(item);

      recalculatedSubtotal += totalPrice;

      return {
        product_id: productId,
        product_name: productName,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice
      };
    });

    const subtotalAmount = recalculatedSubtotal > 0 ? recalculatedSubtotal : submittedSubtotalAmount;
    const totalAmount = subtotalAmount + shippingAmount;

    if (submittedTotalAmount > 0 && totalAmount !== submittedTotalAmount) {
      return json({ success: false, error: "total-mismatch" }, 400);
    }

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

    const cashbackBase = payableAmount;
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

    for (const item of normalizedItems) {
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
        item.product_id,
        item.product_name,
        item.quantity,
        item.unit_price,
        item.total_price
      ).run();
    }

    if (walletUsedAmount > 0) {
      const alreadyHasWalletTx = await hasWalletUseTransaction(context.env.DB, user.id, orderId);

      if (!alreadyHasWalletTx) {
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
        items_count: normalizedItems.length
      }
    });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}