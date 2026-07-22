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
    const search = (url.searchParams.get("search") || "").trim();
    const role = (url.searchParams.get("role") || "").trim();
    const page = toInt(url.searchParams.get("page"), 1);
    const limit = Math.min(toInt(url.searchParams.get("limit"), 20), 100);
    const offset = (page - 1) * limit;

    const where = [];
    const binds = [];

    if (role) {
      where.push("u.role = ?");
      binds.push(role);
    }

    if (search) {
      where.push("(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)");
      const pattern = `%${search}%`;
      binds.push(pattern, pattern, pattern);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countRow = await context.env.DB
      .prepare(`
        SELECT COUNT(*) AS count
        FROM users u
        ${whereSql}
      `)
      .bind(...binds)
      .first();

    const rows = await context.env.DB
      .prepare(`
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.phone,
          u.role,
          u.wallet_balance,
          u.created_at,
          u.updated_at,
          COALESCE(COUNT(o.id), 0) AS orders_count
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.id
        ${whereSql}
        GROUP BY u.id
        ORDER BY u.id DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...binds, limit, offset)
      .all();

    return Response.json({
      success: true,
      page,
      limit,
      total: countRow?.count || 0,
      users: rows.results || []
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
    const user_id = Number(body.user_id || 0);
    const full_name = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const role = String(body.role || "").trim();

    if (!user_id || !full_name || !email || !role) {
      return Response.json(
        { success: false, error: "user_id, full_name, email, role required" },
        { status: 400 }
      );
    }

    const allowedRoles = ["user", "admin", "super_admin"];
    if (!allowedRoles.includes(role)) {
      return Response.json(
        { success: false, error: "invalid role" },
        { status: 400 }
      );
    }

    const targetUser = await context.env.DB
      .prepare(`SELECT id, role FROM users WHERE id = ?`)
      .bind(user_id)
      .first();

    if (!targetUser) {
      return Response.json(
        { success: false, error: "user not found" },
        { status: 404 }
      );
    }

    if (
      String(targetUser.role || "") === "super_admin" &&
      String(adminCheck.user.role || "") !== "super_admin"
    ) {
      return Response.json(
        { success: false, error: "cannot modify super admin" },
        { status: 403 }
      );
    }

    const duplicate = await context.env.DB
      .prepare(`SELECT id FROM users WHERE email = ? AND id != ?`)
      .bind(email, user_id)
      .first();

    if (duplicate) {
      return Response.json(
        { success: false, error: "email already exists" },
        { status: 409 }
      );
    }

    await context.env.DB
      .prepare(`
        UPDATE users
        SET full_name = ?, email = ?, phone = ?, role = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(full_name, email, phone || null, role, user_id)
      .run();

    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "update_user",
      target_type: "user",
      target_id: String(user_id),
      description: `role=${role}, email=${email}`
    });

    const updated = await context.env.DB
      .prepare(`
        SELECT id, full_name, email, phone, role, wallet_balance, created_at, updated_at
        FROM users
        WHERE id = ?
      `)
      .bind(user_id)
      .first();

    return Response.json({
      success: true,
      user: updated
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
    const user_id = Number(body.user_id || 0);

    if (!user_id) {
      return Response.json(
        { success: false, error: "user_id required" },
        { status: 400 }
      );
    }

    const targetUser = await context.env.DB
      .prepare(`
        SELECT id, full_name, email, role, wallet_balance
        FROM users
        WHERE id = ?
      `)
      .bind(user_id)
      .first();

    if (!targetUser) {
      return Response.json(
        { success: false, error: "user not found" },
        { status: 404 }
      );
    }

    if (Number(targetUser.id) === Number(adminCheck.user.id)) {
      return Response.json(
        { success: false, error: "cannot delete current admin user" },
        { status: 403 }
      );
    }

    if (
      String(targetUser.role || "") === "super_admin" &&
      String(adminCheck.user.role || "") !== "super_admin"
    ) {
      return Response.json(
        { success: false, error: "cannot delete super admin" },
        { status: 403 }
      );
    }

    const orderIdsResult = await context.env.DB
      .prepare(`SELECT id FROM orders WHERE user_id = ?`)
      .bind(user_id)
      .all();

    const orderIds = (orderIdsResult?.results || []).map((row) => Number(row.id)).filter(Boolean);

    const statements = [];

    for (const orderId of orderIds) {
      statements.push(
        context.env.DB
          .prepare(`DELETE FROM order_items WHERE order_id = ?`)
          .bind(orderId)
      );
    }

    statements.push(
      context.env.DB
        .prepare(`DELETE FROM orders WHERE user_id = ?`)
        .bind(user_id)
    );

    statements.push(
      context.env.DB
        .prepare(`DELETE FROM wallet_transactions WHERE user_id = ?`)
        .bind(user_id)
    );

    statements.push(
      context.env.DB
        .prepare(`DELETE FROM addresses WHERE user_id = ?`)
        .bind(user_id)
    );

    statements.push(
      context.env.DB
        .prepare(`DELETE FROM sessions WHERE user_id = ?`)
        .bind(user_id)
    );

    statements.push(
      context.env.DB
        .prepare(`DELETE FROM users WHERE id = ?`)
        .bind(user_id)
    );

    await context.env.DB.batch(statements);

    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "delete_user",
      target_type: "user",
      target_id: String(user_id),
      description: `email=${targetUser.email}, role=${targetUser.role}, wallet_balance=${targetUser.wallet_balance}`
    });

    return Response.json({
      success: true,
      message: "user deleted successfully",
      deleted_user: {
        id: targetUser.id,
        full_name: targetUser.full_name,
        email: targetUser.email
      }
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}