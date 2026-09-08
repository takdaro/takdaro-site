// ============================================
// mobile/orders/index.js
// لیست سفارش‌های پنل مدیریت موبایل
// ============================================

import {
  getMobileUser,
  mobileUnauthorized
} from "../../../lib/mobile-auth";

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

function normalizeNumber(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

// ============================================
// GET - دریافت لیست سفارش‌ها
// ============================================

export async function onRequestGet(context) {
  try {
    // ==========================================
    // احراز هویت موبایل
    // ==========================================

    const auth =
      await getMobileUser(context);

    if (!auth.ok) {
      return mobileUnauthorized(
        auth.reason
      );
    }

    // ==========================================
    // پارامترهای جستجو و فیلتر
    // ==========================================

    const url =
      new URL(context.request.url);

    const search =
      normalizeText(
        url.searchParams.get("search")
      );

    const status =
      normalizeText(
        url.searchParams.get("status")
      ).toLowerCase();

    const conditions = [];
    const bindings = [];

    // ==========================================
    // جستجو
    // ==========================================

    if (search) {
      conditions.push(`(
        o.order_number LIKE ?
        OR u.full_name LIKE ?
        OR u.email LIKE ?
        OR u.phone LIKE ?
      )`);

      const query =
        `%${search}%`;

      bindings.push(
        query,
        query,
        query,
        query
      );
    }

    // ==========================================
    // فیلتر وضعیت
    // ==========================================

    if (status) {
      conditions.push(
        `LOWER(o.status) = ?`
      );

      bindings.push(status);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(
            " AND "
          )}`
        : "";

    // ==========================================
    // دریافت سفارش‌ها
    // ==========================================

    const result =
      await context.env.DB
        .prepare(`
          SELECT
            o.id,
            o.order_number,
            o.status,
            o.payment_status,

            COALESCE(
              o.subtotal_amount,
              0
            ) AS subtotal_amount,

            COALESCE(
              o.shipping_amount,
              0
            ) AS shipping_amount,

            COALESCE(
              o.total_amount,
              0
            ) AS total_amount,

            COALESCE(
              o.wallet_used_amount,
              0
            ) AS wallet_used_amount,

            COALESCE(
              o.cashback_amount,
              0
            ) AS cashback_amount,

            COALESCE(
              MAX(
                0,
                COALESCE(
                  o.total_amount,
                  0
                )
                -
                COALESCE(
                  o.wallet_used_amount,
                  0
                )
              ),
              0
            ) AS payable_amount,

            o.created_at,

            u.full_name,
            u.email,
            u.phone AS user_phone,

            a.full_name AS address_full_name,
            a.address_line AS address_line,
            a.postal_code AS address_postal_code,
            a.phone AS address_phone,
            a.city AS address_city,
            a.state AS address_state

          FROM orders o

          LEFT JOIN users u
            ON u.id = o.user_id

          LEFT JOIN addresses a
            ON a.id = o.address_id

          ${whereClause}

          ORDER BY o.id DESC

          LIMIT 300
        `)
        .bind(...bindings)
        .all();

    // ==========================================
    // تبدیل خروجی
    // ==========================================

    const rows =
      Array.isArray(
        result?.results
      )
        ? result.results
        : [];

    const orders =
      rows.map(
        (order) => {
          const address =
            order.address_id
              ? {
                  full_name:
                    order.address_full_name ||
                    "",

                  address_line:
                    order.address_line ||
                    "",

                  postal_code:
                    order.address_postal_code ||
                    "",

                  phone:
                    order.address_phone ||
                    "",

                  city:
                    order.address_city ||
                    "",

                  state:
                    order.address_state ||
                    ""
                }
              : null;

          return {
            id:
              Number(
                order.id || 0
              ),

            order_number:
              order.order_number ||
              "",

            status:
              order.status ||
              "payment_pending",

            payment_status:
              order.payment_status ||
              "pending",

            subtotal_amount:
              normalizeNumber(
                order.subtotal_amount
              ),

            shipping_amount:
              normalizeNumber(
                order.shipping_amount
              ),

            total_amount:
              normalizeNumber(
                order.total_amount
              ),

            wallet_used_amount:
              normalizeNumber(
                order.wallet_used_amount
              ),

            cashback_amount:
              normalizeNumber(
                order.cashback_amount
              ),

            payable_amount:
              Math.max(
                0,
                normalizeNumber(
                  order.payable_amount
                )
              ),

            created_at:
              order.created_at ||
              null,

            full_name:
              order.full_name ||
              "",

            email:
              order.email ||
              "",

            user_phone:
              order.user_phone ||
              "",

            address_city:
              order.address_city ||
              "",

            address_state:
              order.address_state ||
              "",

            address,

            shipping_address:
              address
          };
        }
      );

    // ==========================================
    // پاسخ
    // ==========================================

    return json({
      success: true,
      orders
    });

  } catch (error) {
    console.error(
      "Mobile orders error:",
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