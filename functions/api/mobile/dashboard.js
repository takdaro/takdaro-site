// ============================================
// mobile/dashboard.js
// آمار Dashboard اپ مدیریت
// ============================================

import {
  getMobileUser,
  mobileUnauthorized
} from "../../lib/mobile-auth";

export async function onRequestGet(context) {
  try {
    // ==========================================
    // بررسی Token موبایل
    // ==========================================

    const auth =
      await getMobileUser(context);

    if (!auth.ok) {
      return mobileUnauthorized(
        auth.reason
      );
    }

    // ==========================================
    // دریافت آمار Dashboard
    // ==========================================

    const [
      usersCount,
      ordersCount,
      pendingOrders,
      productsCount,
      revenueSum,
      walletSum
    ] = await context.env.DB.batch([
      context.env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM users
      `),

      context.env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM orders
      `),

      context.env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM orders
        WHERE status = 'pending'
      `),

      context.env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM products
      `),

      context.env.DB.prepare(`
        SELECT COALESCE(
          SUM(total_amount),
          0
        ) AS total
        FROM orders
        WHERE payment_status IN (
          'paid',
          'completed',
          'success'
        )
      `),

      context.env.DB.prepare(`
        SELECT COALESCE(
          SUM(wallet_balance),
          0
        ) AS total
        FROM users
      `)
    ]);

    return Response.json({
      success: true,

      stats: {
        total_users:
          Number(
            usersCount.results?.[0]?.count || 0
          ),

        total_orders:
          Number(
            ordersCount.results?.[0]?.count || 0
          ),

        pending_orders:
          Number(
            pendingOrders.results?.[0]?.count || 0
          ),

        total_products:
          Number(
            productsCount.results?.[0]?.count || 0
          ),

        total_revenue:
          Number(
            revenueSum.results?.[0]?.total || 0
          ),

        total_wallet_balance:
          Number(
            walletSum.results?.[0]?.total || 0
          )
      },

      user: auth.user
    });
  } catch (error) {
    console.error(
      "Mobile dashboard error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          "خطا در دریافت اطلاعات داشبورد."
      },
      {
        status: 500
      }
    );
  }
}