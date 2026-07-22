import { requireAdmin, logAdminAction } from "../../lib/admin";

function json(data, status = 200) {
  return Response.json(data, { status });
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

async function getSetting(db, key, fallback = null) {
  const row = await db
    .prepare(`SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1`)
    .bind(key)
    .first();
  return row ? row.setting_value : fallback;
}

async function getExistingTables(db) {
  const result = await db.prepare(`PRAGMA table_list`).all();
  const rows = result?.results || [];
  return new Set(rows.map((row) => String(row.name || "").trim()).filter(Boolean));
}

async function applyCashbackIfEligible(context, orderId) {
  const db = context.env.DB;

  const order = await db.prepare(`
    SELECT
      id, user_id, order_number, status, total_amount,
      COALESCE(cashback_amount, 0) AS cashback_amount,
      COALESCE(cashback_percent, 0) AS cashback_percent,
      COALESCE(cashback_status, 'none') AS cashback_status,
      cashback_created_txn_id
    FROM orders
    WHERE id = ?
    LIMIT 1
  `).bind(orderId).first();

  if (!order) return { applied: false, reason: "order_not_found" };

  if (String(order.cashback_status || "") === "credited" || order.cashback_created_txn_id) {
    return { applied: false, reason: "already_credited" };
  }

  const cashbackPercent = Math.max(
    0,
    Math.min(Number(await getSetting(db, "cashback_percent", "0")) || 0, 100)
  );

  const allowedStatuses = String(await getSetting(db, "cashback_statuses", "completed,processing"))
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  if (cashbackPercent <= 0) {
    return { applied: false, reason: "cashback_disabled" };
  }

  if (!allowedStatuses.includes(String(order.status || "").toLowerCase())) {
    return { applied: false, reason: "status_not_eligible" };
  }

  const cashbackAmount = Math.max(
    0,
    Math.round((Number(order.total_amount || 0) * cashbackPercent) / 100)
  );

  if (cashbackAmount <= 0) {
    await db.prepare(`
      UPDATE orders
      SET cashback_amount = 0,
          cashback_percent = ?,
          cashback_status = 'skipped',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(cashbackPercent, order.id).run();

    return { applied: false, reason: "cashback_zero" };
  }

  const user = await db.prepare(`
    SELECT id, COALESCE(wallet_balance, 0) AS wallet_balance
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(order.user_id).first();

  if (!user) return { applied: false, reason: "user_not_found" };

  const balanceBefore = Number(user.wallet_balance || 0);
  const balanceAfter = balanceBefore + cashbackAmount;

  const insertTxn = await db.prepare(`
    INSERT INTO wallet_transactions (
      user_id, type, amount, balance_before, balance_after,
      status, source, description, order_id, order_number, created_at
    )
    VALUES (?, 'cashback', ?, ?, ?, 'completed', 'order', ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    order.user_id,
    cashbackAmount,
    balanceBefore,
    balanceAfter,
    `cashback for order ${order.order_number}`,
    order.id,
    order.order_number
  ).run();

  const txnId = Number(insertTxn?.meta?.last_row_id || 0);

  await db.batch([
    db.prepare(`
      UPDATE users
      SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(balanceAfter, order.user_id),

    db.prepare(`
      UPDATE orders
      SET cashback_amount = ?,
          cashback_percent = ?,
          cashback_status = 'credited',
          cashback_created_txn_id = ?,
          cashback_created_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(cashbackAmount, cashbackPercent, txnId, order.id)
  ]);

  return {
    applied: true,
    cashback_amount: cashbackAmount,
    cashback_percent: cashbackPercent,
    balance_after: balanceAfter
  };
}

export async function onRequestGet(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const url = new URL(context.request.url);
    const search = normalizeText(url.searchParams.get("search"));
    const status = normalizeLower(url.searchParams.get("status"));
    const paymentStatus = normalizeLower(url.searchParams.get("payment_status"));

    const where = [];
    const binds = [];

    if (status) {
      where.push(`LOWER(o.status) = ?`);
      binds.push(status);
    }

    if (paymentStatus) {
      where.push(`LOWER(o.payment_status) = ?`);
      binds.push(paymentStatus);
    }

    if (search) {
      where.push(`(
        o.order_number LIKE ?
        OR u.full_name LIKE ?
        OR u.email LIKE ?
        OR u.phone LIKE ?
        OR CAST(o.id AS TEXT) LIKE ?
      )`);
      const pattern = `%${search}%`;
      binds.push(pattern, pattern, pattern, pattern, pattern);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await context.env.DB.prepare(`
      SELECT
        o.id,
        o.order_number,
        o.status,
        o.total_amount,
        o.shipping_amount,
        o.discount_amount,
        o.payment_status,
        o.created_at,
        o.updated_at,
        COALESCE(o.cashback_amount, 0) AS cashback_amount,
        COALESCE(o.cashback_percent, 0) AS cashback_percent,
        COALESCE(o.cashback_status, 'none') AS cashback_status,
        u.id AS user_id,
        u.full_name,
        u.email,
        u.phone
      FROM orders o
      JOIN users u ON u.id = o.user_id
      ${whereSql}
      ORDER BY o.id DESC
    `).bind(...binds).all();

    return json({
      success: true,
      orders: rows.results || []
    });
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const body = await context.request.json();
    const orderNumber = normalizeText(body.order_number);
    const status = normalizeLower(body.status);
    const paymentStatus = normalizeLower(body.payment_status);

    if (!orderNumber) {
      return json({ success: false, error: "order_number required" }, 400);
    }

    const order = await context.env.DB.prepare(`
      SELECT id, order_number, status, payment_status
      FROM orders
      WHERE order_number = ?
      LIMIT 1
    `).bind(orderNumber).first();

    if (!order) {
      return json({ success: false, error: "order not found" }, 404);
    }

    const nextStatus = status || order.status;
    const nextPaymentStatus = paymentStatus || order.payment_status;

    await context.env.DB.prepare(`
      UPDATE orders
      SET status = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(nextStatus, nextPaymentStatus, order.id).run();

    const cashback = await applyCashbackIfEligible(context, order.id);

    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "update_order",
      target_type: "order",
      target_id: String(order.id),
      description: `order_number=${orderNumber}, status=${nextStatus}, payment_status=${nextPaymentStatus}, cashback=${cashback.applied ? "yes" : cashback.reason}`
    });

    return json({
      success: true,
      order_number: orderNumber,
      status: nextStatus,
      payment_status: nextPaymentStatus,
      cashback
    });
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}

export async function onRequestDelete(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const body = await context.request.json();
    const orderNumber = normalizeText(body.order_number);

    if (!orderNumber) {
      return json({ success: false, error: "order_number required" }, 400);
    }

    const db = context.env.DB;
    const tables = await getExistingTables(db);

    const order = await db.prepare(`
      SELECT id, order_number, user_id, total_amount, payment_status, status
      FROM orders
      WHERE order_number = ?
      LIMIT 1
    `).bind(orderNumber).first();

    if (!order) {
      return json({ success: false, error: "order not found" }, 404);
    }

    const statements = [];

    if (tables.has("order_items")) {
      statements.push(
        db.prepare(`DELETE FROM order_items WHERE order_id = ?`).bind(order.id)
      );
    }

    if (tables.has("wallet_transactions")) {
      statements.push(
        db.prepare(`DELETE FROM wallet_transactions WHERE order_id = ?`).bind(order.id)
      );
    }

    statements.push(
      db.prepare(`DELETE FROM orders WHERE id = ?`).bind(order.id)
    );

    await db.batch(statements);

    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "delete_order",
      target_type: "order",
      target_id: String(order.id),
      description: `order_number=${order.order_number}, status=${order.status}, payment_status=${order.payment_status}, total_amount=${order.total_amount}`
    });

    return json({
      success: true,
      message: "order deleted successfully",
      deleted_order: {
        id: order.id,
        order_number: order.order_number
      }
    });
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}