function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
      role
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

function isAdmin(user) {
  const role = String(user?.role || "").toLowerCase();
  return role === "admin" || role === "super_admin";
}

async function getOrderByNumber(db, orderNumber) {
  return await db.prepare(`
    SELECT
      o.id,
      o.user_id,
      o.order_number,
      o.address_id,
      o.status,
      o.payment_status,
      o.subtotal_amount,
      o.shipping_amount,
      o.total_amount,
      COALESCE(o.wallet_used_amount, 0) AS wallet_used_amount,
      COALESCE(o.cashback_amount, 0) AS cashback_amount,
      COALESCE(o.cashback_status, 'none') AS cashback_status,
      o.notes,
      o.created_at,
      o.updated_at,
      u.full_name,
      u.email,
      u.phone,
      a.full_name AS address_full_name,
      a.address_line,
      a.postal_code,
      a.city,
      a.state
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN user_addresses a ON a.id = o.address_id
    WHERE o.order_number = ?
    LIMIT 1
  `).bind(orderNumber).first();
}

async function getOrderItems(db, orderId) {
  const result = await db.prepare(`
    SELECT
      id,
      product_id,
      product_name,
      quantity,
      unit_price,
      total_price
    FROM order_items
    WHERE order_id = ?
    ORDER BY id ASC
  `).bind(orderId).all();

  return Array.isArray(result?.results) ? result.results : [];
}

async function hasCompletedCashbackTx(db, userId, orderId) {
  const row = await db.prepare(`
    SELECT id
    FROM wallet_transactions
    WHERE user_id = ?
      AND order_id = ?
      AND type = 'cashback'
      AND status = 'completed'
    LIMIT 1
  `).bind(userId, orderId).first();

  return !!row;
}

async function hasCashbackReversalTx(db, userId, orderId) {
  const row = await db.prepare(`
    SELECT id
    FROM wallet_transactions
    WHERE user_id = ?
      AND order_id = ?
      AND type = 'debit'
      AND source = 'cashback_reversal'
      AND status = 'completed'
    LIMIT 1
  `).bind(userId, orderId).first();

  return !!row;
}

async function applyCashbackIfNeeded(db, order, actorUserId) {
  const orderId = Number(order?.id || 0);
  const userId = Number(order?.user_id || 0);
  const cashbackAmount = Math.max(0, Math.round(normalizeNumber(order?.cashback_amount)));

  if (!orderId || !userId || cashbackAmount <= 0) {
    await db.prepare(`
      UPDATE orders
      SET cashback_status = 'none',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId).run();

    return { applied: false, reason: "no_cashback" };
  }

  if (String(order.cashback_status || "").toLowerCase() === "completed") {
    return { applied: false, reason: "already_completed" };
  }

  const alreadyDone = await hasCompletedCashbackTx(db, userId, orderId);
  if (alreadyDone) {
    await db.prepare(`
      UPDATE orders
      SET cashback_status = 'completed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId).run();

    return { applied: false, reason: "transaction_exists" };
  }

  const user = await db.prepare(`
    SELECT
      id,
      COALESCE(wallet_balance, 0) AS wallet_balance
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(userId).first();

  if (!user) {
    return { applied: false, reason: "user_not_found" };
  }

  const balanceBefore = Math.max(0, normalizeNumber(user.wallet_balance));
  const balanceAfter = balanceBefore + cashbackAmount;

  await db.batch([
    db.prepare(`
      UPDATE users
      SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(balanceAfter, userId),

    db.prepare(`
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
      VALUES (?, 'cashback', ?, ?, ?, 'completed', 'order_completion', ?, ?, ?, ?, 'order', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      userId,
      cashbackAmount,
      balanceBefore,
      balanceAfter,
      `Cashback for completed order ${order.order_number}`,
      `کش‌بک سفارش ${order.order_number}`,
      orderId,
      order.order_number,
      String(orderId),
      actorUserId || null
    ),

    db.prepare(`
      UPDATE orders
      SET cashback_status = 'completed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId)
  ]);

  return { applied: true, amount: cashbackAmount };
}

async function reverseCashbackIfNeeded(db, order, actorUserId) {
  const orderId = Number(order?.id || 0);
  const userId = Number(order?.user_id || 0);
  const cashbackAmount = Math.max(0, Math.round(normalizeNumber(order?.cashback_amount)));

  if (!orderId || !userId || cashbackAmount <= 0) {
    return { reversed: false, reason: "no_cashback" };
  }

  if (String(order.cashback_status || "").toLowerCase() !== "completed") {
    return { reversed: false, reason: "not_completed" };
  }

  const alreadyReversed = await hasCashbackReversalTx(db, userId, orderId);
  if (alreadyReversed) {
    await db.prepare(`
      UPDATE orders
      SET cashback_status = 'reversed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId).run();

    return { reversed: false, reason: "already_reversed" };
  }

  const cashbackExists = await hasCompletedCashbackTx(db, userId, orderId);
  if (!cashbackExists) {
    await db.prepare(`
      UPDATE orders
      SET cashback_status = 'none',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId).run();

    return { reversed: false, reason: "cashback_tx_missing" };
  }

  const user = await db.prepare(`
    SELECT
      id,
      COALESCE(wallet_balance, 0) AS wallet_balance
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(userId).first();

  if (!user) {
    return { reversed: false, reason: "user_not_found" };
  }

  const balanceBefore = Math.max(0, normalizeNumber(user.wallet_balance));
  const reversalAmount = Math.min(balanceBefore, cashbackAmount);
  const balanceAfter = Math.max(0, balanceBefore - reversalAmount);

  await db.batch([
    db.prepare(`
      UPDATE users
      SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(balanceAfter, userId),

    db.prepare(`
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
      VALUES (?, 'debit', ?, ?, ?, 'completed', 'cashback_reversal', ?, ?, ?, ?, 'order', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      userId,
      reversalAmount,
      balanceBefore,
      balanceAfter,
      `Cashback reversal for order ${order.order_number}`,
      `برگشت کش‌بک سفارش ${order.order_number}`,
      orderId,
      order.order_number,
      String(orderId),
      actorUserId || null
    ),

    db.prepare(`
      UPDATE orders
      SET cashback_status = 'reversed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId)
  ]);

  return { reversed: true, amount: reversalAmount };
}

async function updateOrderAndCashback(db, orderNumber, payload, actorUserId) {
  const nextStatus = normalizeText(payload?.status).toLowerCase();
  const nextPaymentStatus = normalizeText(payload?.payment_status).toLowerCase();

  const allowedOrderStatuses = ["pending", "processing", "shipped", "completed", "cancelled"];
  const allowedPaymentStatuses = ["pending", "paid", "completed", "failed"];

  if (nextStatus && !allowedOrderStatuses.includes(nextStatus)) {
    return { ok: false, response: json({ success: false, error: "invalid_order_status" }, 400) };
  }

  if (nextPaymentStatus && !allowedPaymentStatuses.includes(nextPaymentStatuses)) {
    return { ok: false, response: json({ success: false, error: "invalid_payment_status" }, 400) };
  }

  const currentOrder = await getOrderByNumber(db, orderNumber);

  if (!currentOrder) {
    return { ok: false, response: json({ success: false, error: "order_not_found" }, 404) };
  }

  const finalStatus = nextStatus || String(currentOrder.status || "pending").toLowerCase();
  const finalPaymentStatus = nextPaymentStatus || String(currentOrder.payment_status || "pending").toLowerCase();

  await db.prepare(`
    UPDATE orders
    SET
      status = ?,
      payment_status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(finalStatus, finalPaymentStatus, currentOrder.id).run();

  const updatedOrder = await getOrderByNumber(db, orderNumber);

  let cashbackResult = null;

  if (finalStatus === "completed") {
    cashbackResult = await applyCashbackIfNeeded(db, updatedOrder, actorUserId);
  } else if (
    ["pending", "processing", "shipped", "cancelled"].includes(finalStatus) &&
    String(updatedOrder.cashback_status || "").toLowerCase() === "completed"
  ) {
    cashbackResult = await reverseCashbackIfNeeded(db, updatedOrder, actorUserId);
  }

  const finalOrder = await getOrderByNumber(db, orderNumber);
  const items = await getOrderItems(db, finalOrder.id);

  return {
    ok: true,
    data: {
      success: true,
      message: "order_updated",
      cashback_result: cashbackResult,
      order: {
        ...finalOrder,
        subtotal_amount: normalizeNumber(finalOrder.subtotal_amount),
        shipping_amount: normalizeNumber(finalOrder.shipping_amount),
        total_amount: normalizeNumber(finalOrder.total_amount),
        wallet_used_amount: normalizeNumber(finalOrder.wallet_used_amount),
        cashback_amount: normalizeNumber(finalOrder.cashback_amount),
        items
      }
    }
  };
}

export async function onRequestGet(context) {
  try {
    const user = await getCurrentUser(context);

    if (!user || !isAdmin(user)) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

    const orderNumber = decodeURIComponent(context.params.order || "").trim();

    if (!orderNumber) {
      return json({ success: false, error: "order_number_required" }, 400);
    }

    const order = await getOrderByNumber(context.env.DB, orderNumber);

    if (!order) {
      return json({ success: false, error: "order_not_found" }, 404);
    }

    const items = await getOrderItems(context.env.DB, order.id);

    return json({
      success: true,
      order: {
        ...order,
        subtotal_amount: normalizeNumber(order.subtotal_amount),
        shipping_amount: normalizeNumber(order.shipping_amount),
        total_amount: normalizeNumber(order.total_amount),
        wallet_used_amount: normalizeNumber(order.wallet_used_amount),
        cashback_amount: normalizeNumber(order.cashback_amount),
        items
      }
    });
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const user = await getCurrentUser(context);

    if (!user || !isAdmin(user)) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

    const orderNumber = decodeURIComponent(context.params.order || "").trim();

    if (!orderNumber) {
      return json({ success: false, error: "order_number_required" }, 400);
    }

    const body = await context.request.json().catch(() => null);
    const result = await updateOrderAndCashback(context.env.DB, orderNumber, body, user.id);

    if (!result.ok) {
      return result.response;
    }

    return json(result.data);
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}

export async function onRequestPatch(context) {
  try {
    const user = await getCurrentUser(context);

    if (!user || !isAdmin(user)) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

    const orderNumber = decodeURIComponent(context.params.order || "").trim();

    if (!orderNumber) {
      return json({ success: false, error: "order_number_required" }, 400);
    }

    const body = await context.request.json().catch(() => null);
    const result = await updateOrderAndCashback(context.env.DB, orderNumber, body, user.id);

    if (!result.ok) {
      return result.response;
    }

    return json(result.data);
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}