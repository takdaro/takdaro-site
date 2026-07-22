import { requireAdmin, logAdminAction } from "../../lib/admin";
import { hashPassword } from "../../lib/password";

function toInt(value, fallback = 1) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "")
    .trim()
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/\D/g, "");
}

function isAllowedRole(role) {
  return ["user", "admin", "super_admin"].includes(String(role || "").trim());
}

async function getExistingTables(db) {
  const result = await db.prepare(`PRAGMA table_list`).all();
  const rows = result?.results || [];
  return new Set(rows.map((row) => String(row.name || "").trim()).filter(Boolean));
}

function canManageRole(actorRole, targetRole) {
  const actor = String(actorRole || "").trim();
  const target = String(targetRole || "").trim();

  if (actor === "super_admin") return true;
  if (actor === "admin") return target === "user" || target === "admin";
  return false;
}

function canEditTarget(actorRole, currentTargetRole, requestedRole) {
  const actor = String(actorRole || "").trim();
  const currentRole = String(currentTargetRole || "").trim();
  const nextRole = String(requestedRole || currentRole).trim();

  if (actor === "super_admin") return true;

  if (actor === "admin") {
    if (currentRole === "super_admin") return false;
    if (nextRole === "super_admin") return false;
    return true;
  }

  return false;
}

export async function onRequestGet(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const url = new URL(context.request.url);
    const search = normalizeText(url.searchParams.get("search"));
    const role = normalizeText(url.searchParams.get("role"));
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
      where.push("(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR CAST(u.id AS TEXT) LIKE ?)");
      const pattern = `%${search}%`;
      binds.push(pattern, pattern, pattern, pattern);
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
          COALESCE(u.wallet_balance, 0) AS wallet_balance,
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

    const full_name = normalizeText(body.full_name);
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);
    const role = normalizeText(body.role || "user");

    if (!full_name || !email || !role) {
      return Response.json(
        { success: false, error: "full_name, email, role required" },
        { status: 400 }
      );
    }

    if (!isAllowedRole(role)) {
      return Response.json(
        { success: false, error: "invalid role" },
        { status: 400 }
      );
    }

    if (user_id > 0) {
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

      if (!canEditTarget(adminCheck.user.role, targetUser.role, role)) {
        return Response.json(
          { success: false, error: "cannot modify this user" },
          { status: 403 }
        );
      }

      const duplicate = await context.env.DB
        .prepare(`SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?`)
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
          SET
            full_name = ?,
            email = ?,
            phone = ?,
            role = ?,
            updated_at = CURRENT_TIMESTAMP
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
          SELECT
            id,
            full_name,
            email,
            phone,
            role,
            COALESCE(wallet_balance, 0) AS wallet_balance,
            created_at,
            updated_at
          FROM users
          WHERE id = ?
        `)
        .bind(user_id)
        .first();

      return Response.json({
        success: true,
        mode: "update",
        user: updated
      });
    }

    const password = String(body.password || "");
    const password_confirm = String(body.password_confirm || "");

    if (!password || !password_confirm) {
      return Response.json(
        { success: false, error: "password and password_confirm required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return Response.json(
        { success: false, error: "password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (password !== password_confirm) {
      return Response.json(
        { success: false, error: "password confirmation does not match" },
        { status: 400 }
      );
    }

    if (!canManageRole(adminCheck.user.role, role)) {
      return Response.json(
        { success: false, error: "cannot create user with this role" },
        { status: 403 }
      );
    }

    const duplicate = await context.env.DB
      .prepare(`SELECT id FROM users WHERE LOWER(email) = LOWER(?)`)
      .bind(email)
      .first();

    if (duplicate) {
      return Response.json(
        { success: false, error: "email already exists" },
        { status: 409 }
      );
    }

    const password_hash = await hashPassword(password);

    const insertResult = await context.env.DB
      .prepare(`
        INSERT INTO users (
          full_name,
          email,
          phone,
          password_hash,
          role,
          wallet_balance,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)
      .bind(full_name, email, phone || null, password_hash, role)
      .run();

    const newUserId = Number(insertResult?.meta?.last_row_id || 0);

    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "create_user",
      target_type: "user",
      target_id: String(newUserId || ""),
      description: `role=${role}, email=${email}`
    });

    const created = await context.env.DB
      .prepare(`
        SELECT
          id,
          full_name,
          email,
          phone,
          role,
          COALESCE(wallet_balance, 0) AS wallet_balance,
          created_at,
          updated_at
        FROM users
        WHERE id = ?
      `)
      .bind(newUserId)
      .first();

    return Response.json({
      success: true,
      mode: "create",
      user: created
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

    const tables = await getExistingTables(context.env.DB);

    const orderIds = [];
    if (tables.has("orders")) {
      const orderIdsResult = await context.env.DB
        .prepare(`SELECT id FROM orders WHERE user_id = ?`)
        .bind(user_id)
        .all();

      for (const row of orderIdsResult?.results || []) {
        const id = Number(row?.id || 0);
        if (id) orderIds.push(id);
      }
    }

    const statements = [];

    if (tables.has("order_items") && orderIds.length) {
      for (const orderId of orderIds) {
        statements.push(
          context.env.DB
            .prepare(`DELETE FROM order_items WHERE order_id = ?`)
            .bind(orderId)
        );
      }
    }

    if (tables.has("orders")) {
      statements.push(
        context.env.DB
          .prepare(`DELETE FROM orders WHERE user_id = ?`)
          .bind(user_id)
      );
    }

    if (tables.has("wallet_transactions")) {
      statements.push(
        context.env.DB
          .prepare(`DELETE FROM wallet_transactions WHERE user_id = ?`)
          .bind(user_id)
      );
    }

    if (tables.has("addresses")) {
      statements.push(
        context.env.DB
          .prepare(`DELETE FROM addresses WHERE user_id = ?`)
          .bind(user_id)
      );
    }

    if (tables.has("sessions")) {
      statements.push(
        context.env.DB
          .prepare(`DELETE FROM sessions WHERE user_id = ?`)
          .bind(user_id)
      );
    }

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