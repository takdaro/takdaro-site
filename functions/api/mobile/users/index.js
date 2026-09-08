// ============================================
// mobile/users/index.js
// مدیریت کاربران اپ مدیریت Takdaro
// ============================================

import {
  getMobileUser,
  mobileUnauthorized
} from "../../../lib/mobile-auth";

import { hashPassword } from "../../../lib/password";

// ============================================
// ابزارهای کمکی
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

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeEmail(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizePhone(value) {
  return String(value ?? "")
    .trim()
    .replace(/[۰-۹]/g, (d) =>
      "۰۱۲۳۴۵۶۷۸۹".indexOf(d)
    )
    .replace(/\D/g, "");
}

function toPositiveInt(value, fallback = 1) {
  const number =
    Number.parseInt(value, 10);

  return Number.isFinite(number) &&
    number > 0
    ? number
    : fallback;
}

function isAllowedRole(role) {
  return [
    "user",
    "admin",
    "super_admin"
  ].includes(
    String(role ?? "").trim()
  );
}

// ============================================
// بررسی سطح دسترسی نقش
// ============================================

function canManageRole(
  actorRole,
  targetRole
) {
  const actor =
    String(actorRole ?? "").trim();

  const target =
    String(targetRole ?? "").trim();

  if (actor === "super_admin") {
    return true;
  }

  if (actor === "admin") {
    return (
      target === "user" ||
      target === "admin"
    );
  }

  return false;
}

function canEditTarget(
  actorRole,
  currentTargetRole,
  requestedRole
) {
  const actor =
    String(actorRole ?? "").trim();

  const currentRole =
    String(currentTargetRole ?? "").trim();

  const nextRole =
    String(
      requestedRole ?? currentRole
    ).trim();

  if (actor === "super_admin") {
    return true;
  }

  if (actor === "admin") {
    if (
      currentRole === "super_admin"
    ) {
      return false;
    }

    if (
      nextRole === "super_admin"
    ) {
      return false;
    }

    return true;
  }

  return false;
}

// ============================================
// GET
// دریافت لیست کاربران
// ============================================

export async function onRequestGet(
  context
) {
  try {
    const auth =
      await getMobileUser(context);

    if (!auth.ok) {
      return mobileUnauthorized(
        auth.reason
      );
    }

    const url =
      new URL(
        context.request.url
      );

    const search =
      normalizeText(
        url.searchParams.get(
          "search"
        )
      );

    const role =
      normalizeText(
        url.searchParams.get(
          "role"
        )
      );

    const page =
      toPositiveInt(
        url.searchParams.get(
          "page"
        ),
        1
      );

    const limit = Math.min(
      toPositiveInt(
        url.searchParams.get(
          "limit"
        ),
        20
      ),
      100
    );

    const offset =
      (page - 1) * limit;

    if (
      role &&
      !isAllowedRole(role)
    ) {
      return json(
        {
          success: false,
          error: "invalid_role"
        },
        400
      );
    }

    const conditions = [];
    const bindings = [];

    // ==========================================
    // فیلتر نقش
    // ==========================================

    if (role) {
      conditions.push(
        "u.role = ?"
      );

      bindings.push(role);
    }

    // ==========================================
    // جستجو
    // ==========================================

    if (search) {
      conditions.push(`
        (
          u.full_name LIKE ?
          OR u.email LIKE ?
          OR u.phone LIKE ?
          OR CAST(u.id AS TEXT) LIKE ?
        )
      `);

      const pattern =
        `%${search}%`;

      bindings.push(
        pattern,
        pattern,
        pattern,
        pattern
      );
    }

    const whereSql =
      conditions.length
        ? `WHERE ${conditions.join(
            " AND "
          )}`
        : "";

    // ==========================================
    // تعداد کل کاربران
    // ==========================================

    const countRow =
      await context.env.DB
        .prepare(`
          SELECT
            COUNT(*) AS count
          FROM users u
          ${whereSql}
        `)
        .bind(...bindings)
        .first();

    // ==========================================
    // لیست کاربران
    // ==========================================

    const result =
      await context.env.DB
        .prepare(`
          SELECT
            u.id,
            u.full_name,
            u.email,
            u.phone,
            u.role,

            COALESCE(
              u.wallet_balance,
              0
            ) AS wallet_balance,

            u.created_at,
            u.updated_at,

            COALESCE(
              COUNT(o.id),
              0
            ) AS orders_count

          FROM users u

          LEFT JOIN orders o
            ON o.user_id = u.id

          ${whereSql}

          GROUP BY u.id

          ORDER BY u.id DESC

          LIMIT ?
          OFFSET ?
        `)
        .bind(
          ...bindings,
          limit,
          offset
        )
        .all();

    const users =
      Array.isArray(
        result?.results
      )
        ? result.results
        : [];

    return json({
      success: true,

      page,

      limit,

      total:
        Number(
          countRow?.count || 0
        ),

      total_pages:
        Math.ceil(
          Number(
            countRow?.count || 0
          ) / limit
        ),

      users
    });

  } catch (error) {
    console.error(
      "Mobile users GET error:",
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
// POST
// ایجاد یا ویرایش کاربر
// ============================================

export async function onRequestPost(
  context
) {
  try {
    const auth =
      await getMobileUser(context);

    if (!auth.ok) {
      return mobileUnauthorized(
        auth.reason
      );
    }

    const body =
      await context.request.json();

    const userId =
      Number(
        body?.user_id || 0
      );

    const fullName =
      normalizeText(
        body?.full_name
      );

    const email =
      normalizeEmail(
        body?.email
      );

    const phone =
      normalizePhone(
        body?.phone
      );

    const role =
      normalizeText(
        body?.role || "user"
      );

    if (
      !fullName ||
      !email ||
      !role
    ) {
      return json(
        {
          success: false,
          error:
            "full_name_email_role_required"
        },
        400
      );
    }

    if (
      !isAllowedRole(role)
    ) {
      return json(
        {
          success: false,
          error: "invalid_role"
        },
        400
      );
    }

    // ==========================================
    // ویرایش کاربر
    // ==========================================

    if (userId > 0) {
      const target =
        await context.env.DB
          .prepare(`
            SELECT
              id,
              full_name,
              email,
              phone,
              role,
              wallet_balance
            FROM users
            WHERE id = ?
            LIMIT 1
          `)
          .bind(userId)
          .first();

      if (!target) {
        return json(
          {
            success: false,
            error: "user_not_found"
          },
          404
        );
      }

      if (
        !canEditTarget(
          auth.user.role,
          target.role,
          role
        )
      ) {
        return json(
          {
            success: false,
            error:
              "cannot_modify_this_user"
          },
          403
        );
      }

      const duplicate =
        await context.env.DB
          .prepare(`
            SELECT id
            FROM users
            WHERE LOWER(email) =
              LOWER(?)
              AND id != ?
            LIMIT 1
          `)
          .bind(
            email,
            userId
          )
          .first();

      if (duplicate) {
        return json(
          {
            success: false,
            error:
              "email_already_exists"
          },
          409
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
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(
          fullName,
          email,
          phone || null,
          role,
          userId
        )
        .run();

      const updated =
        await context.env.DB
          .prepare(`
            SELECT
              id,
              full_name,
              email,
              phone,
              role,

              COALESCE(
                wallet_balance,
                0
              ) AS wallet_balance,

              created_at,
              updated_at

            FROM users

            WHERE id = ?

            LIMIT 1
          `)
          .bind(userId)
          .first();

      return json({
        success: true,
        mode: "update",
        user: updated
      });

    }

    // ==========================================
    // ایجاد کاربر جدید
    // ==========================================

    const password =
      String(
        body?.password || ""
      );

    const passwordConfirm =
      String(
        body?.password_confirm ||
        ""
      );

    if (
      !password ||
      !passwordConfirm
    ) {
      return json(
        {
          success: false,
          error:
            "password_required"
        },
        400
      );
    }

    if (
      password.length < 8
    ) {
      return json(
        {
          success: false,
          error:
            "password_min_8_characters"
        },
        400
      );
    }

    if (
      password !==
      passwordConfirm
    ) {
      return json(
        {
          success: false,
          error:
            "password_confirmation_mismatch"
        },
        400
      );
    }

    if (
      !canManageRole(
        auth.user.role,
        role
      )
    ) {
      return json(
        {
          success: false,
          error:
            "cannot_create_this_role"
        },
        403
      );
    }

    const duplicate =
      await context.env.DB
        .prepare(`
          SELECT id
          FROM users
          WHERE LOWER(email) =
            LOWER(?)
          LIMIT 1
        `)
        .bind(email)
        .first();

    if (duplicate) {
      return json(
        {
          success: false,
          error:
            "email_already_exists"
        },
        409
      );
    }

    const passwordHash =
      await hashPassword(
        password
      );

    const insertResult =
      await context.env.DB
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

          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            0,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `)
        .bind(
          fullName,
          email,
          phone || null,
          passwordHash,
          role
        )
        .run();

    const newUserId =
      Number(
        insertResult?.meta
          ?.last_row_id || 0
      );

    const created =
      await context.env.DB
        .prepare(`
          SELECT
            id,
            full_name,
            email,
            phone,
            role,

            COALESCE(
              wallet_balance,
              0
            ) AS wallet_balance,

            created_at,
            updated_at

          FROM users

          WHERE id = ?

          LIMIT 1
        `)
        .bind(newUserId)
        .first();

    return json({
      success: true,
      mode: "create",
      user: created
    });

  } catch (error) {
    console.error(
      "Mobile users POST error:",
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
// DELETE
// حذف کاربر
// ============================================

export async function onRequestDelete(
  context
) {
  try {
    const auth =
      await getMobileUser(context);

    if (!auth.ok) {
      return mobileUnauthorized(
        auth.reason
      );
    }

    const body =
      await context.request.json();

    const userId =
      Number(
        body?.user_id || 0
      );

    if (!userId) {
      return json(
        {
          success: false,
          error: "user_id_required"
        },
        400
      );
    }

    // ==========================================
    // جلوگیری از حذف خود مدیر
    // ==========================================

    if (
      Number(userId) ===
      Number(auth.user.id)
    ) {
      return json(
        {
          success: false,
          error:
            "cannot_delete_current_admin"
        },
        403
      );
    }

    const target =
      await context.env.DB
        .prepare(`
          SELECT
            id,
            full_name,
            email,
            role,
            wallet_balance
          FROM users
          WHERE id = ?
          LIMIT 1
        `)
        .bind(userId)
        .first();

    if (!target) {
      return json(
        {
          success: false,
          error: "user_not_found"
        },
        404
      );
    }

    if (
      !canEditTarget(
        auth.user.role,
        target.role,
        target.role
      )
    ) {
      return json(
        {
          success: false,
          error:
            "cannot_delete_this_user"
        },
        403
      );
    }

    // ==========================================
    // حذف وابستگی‌های کاربر
    // ==========================================

    const orderIdsResult =
      await context.env.DB
        .prepare(`
          SELECT id
          FROM orders
          WHERE user_id = ?
        `)
        .bind(userId)
        .all();

    const orderIds =
      Array.isArray(
        orderIdsResult?.results
      )
        ? orderIdsResult.results
            .map(
              (row) =>
                Number(row?.id || 0)
            )
            .filter(
              (id) => id > 0
            )
        : [];

    const statements = [];

    // order_items
    for (
      const orderId of orderIds
    ) {
      statements.push(
        context.env.DB
          .prepare(`
            DELETE FROM order_items
            WHERE order_id = ?
          `)
          .bind(orderId)
      );
    }

    // orders
    statements.push(
      context.env.DB
        .prepare(`
          DELETE FROM orders
          WHERE user_id = ?
        `)
        .bind(userId)
    );

    // wallet transactions
    statements.push(
      context.env.DB
        .prepare(`
          DELETE FROM wallet_transactions
          WHERE user_id = ?
        `)
        .bind(userId)
    );

    // آدرس‌ها
    statements.push(
      context.env.DB
        .prepare(`
          DELETE FROM user_addresses
          WHERE user_id = ?
        `)
        .bind(userId)
    );

    // sessionهای معمولی
    statements.push(
      context.env.DB
        .prepare(`
          DELETE FROM sessions
          WHERE user_id = ?
        `)
        .bind(userId)
    );

    // ==========================================
    // حذف کاربر
    // ==========================================

    statements.push(
      context.env.DB
        .prepare(`
          DELETE FROM users
          WHERE id = ?
        `)
        .bind(userId)
    );

    await context.env.DB.batch(
      statements
    );

    return json({
      success: true,

      message:
        "user_deleted",

      deleted_user: {
        id:
          target.id,

        full_name:
          target.full_name,

        email:
          target.email
      }
    });

  } catch (error) {
    console.error(
      "Mobile users DELETE error:",
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