import { requireAdmin, logAdminAction } from "../../lib/admin";

function toInt(value, fallback = 1) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function onRequestGet(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const url = new URL(context.request.url);
    const status = (url.searchParams.get("status") || "").trim();
    const paymentStatus = (url.searchParams.get("payment_status") || "").trim();
    const search = (url.searchParams.get("search") || "").trim();
    const page = toInt(url.searchParams.get("page"), 1);
    const limit = Math.min(toInt(url.searchParams.get("limit"), 20), 100);
    const offset = (page - 1) * limit;

    let where = [];
    let binds = [];

    if (status) {
      where.push("o.status = ?");
      binds.push(status);
    }

    if (paymentStatus) {
      where.push("o.payment_status = ?");
      binds.push(paymentStatus);
    }

    if (search) {
      where.push("(o.order_number LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)");
      const pattern = `%${search}%`;
      binds.push(pattern, pattern, pattern);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countRow = await context.env.DB
      .prepare(`
        SELECT COUNT(*) AS count
        FROM orders o
        JOIN users u ON u.id = o.user_id
        ${whereSql}
      `)
      .bind(...binds)
      .first();

    const rows = await context.env.DB
      .prepare(`
        SELECT
          o.id,
          o.order_number,
          o.status,
          o.total_amount,
          o.shipping_amount,
          o.discount_amount,
          o.payment_status,
          o.created_at,
          u.id AS user_id,
          u.full_name,
          u.email,
          u.phone
        FROM orders o
        JOIN users u ON u.id = o.user_id
        ${whereSql}
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...binds, limit, offset)
      .all();

    return Response.json({
      success: true,
      page,
      limit,
      total: countRow?.count || 0,
      orders: rows.results || []
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}

export async function onRequestPost(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const body = await context.request.json();
    const order_number = String(body.order_number || "").trim();
    const status = String(body.status || "").trim();
    const payment_status = String(body.payment_status || "").trim();

    if (!order_number) {
      return Response.json(
        { success: false, error: "order_number required" },
        { status: 400 }
      );
    }

    const order = await context.env.DB
      .prepare(`SELECT id, order_number, status, payment_status FROM orders WHERE order_number = ?`)
      .bind(order_number)
      .first();

    if (!order) {
      return Response.json(
        { success: false, error: "order not found" },
        { status: 404 }
      );
    }

    const nextStatus = status || order.status;
    const nextPaymentStatus = payment_status || order.payment_status;

    await context.env.DB
      .prepare(`
        UPDATE orders
        SET status = ?, payment_status = ?
        WHERE order_number = ?
      `)
      .bind(nextStatus, nextPaymentStatus, order_number)
      .run();

    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "update_order",
      target_type: "order",
      target_id: order_number,
      description: `status=${nextStatus}, payment_status=${nextPaymentStatus}`
    });

    const updated = await context.env.DB
      .prepare(`
        SELECT id, order_number, status, payment_status, total_amount, shipping_amount, discount_amount, created_at
        FROM orders
        WHERE order_number = ?
      `)
      .bind(order_number)
      .first();

    return Response.json({
      success: true,
      order: updated
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}

export async function onRequestDelete(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const body = await context.request.json();
    const order_number = String(body.order_number || "").trim();

    if (!order_number) {
      return Response.json(
        { success: false, error: "order_number required" },
        { status: 400 }
      );
    }

    const order = await context.env.DB
      .prepare(`
        SELECT id, order_number, user_id, total_amount, status, payment_status
        FROM orders
        WHERE order_number = ?
      `)
      .bind(order_number)
      .first();

    if (!order) {
      return Response.json(
        { success: false, error: "order not found" },
        { status: 404 }
      );
    }

    await context.env.DB
      .prepare(`DELETE FROM order_items WHERE order_id = ?`)
      .bind(order.id)
      .run();

    await context.env.DB
      .prepare(`DELETE FROM orders WHERE id = ?`)
      .bind(order.id)
      .run();

    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "delete_order",
      target_type: "order",
      target_id: order.order_number,
      description: `user_id=${order.user_id}, total_amount=${order.total_amount}, status=${order.status}, payment_status=${order.payment_status}`
    });

    return Response.json({
      success: true,
      message: "order deleted successfully",
      deleted_order_number: order.order_number
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}