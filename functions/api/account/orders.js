import { getCurrentUser } from "../../lib/admin";

function json(data, status = 200) {
  return Response.json(data, { status });
}

// ============================================
// GET - دریافت لیست سفارش‌های کاربر
// ============================================
export async function onRequestGet(context) {
  try {
    const user = await getCurrentUser(context);

    if (!user) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

    const orders = await context.env.DB
      .prepare(`
        SELECT
          id,
          order_number,
          status,
          payment_status,
          total_amount,
          shipping_amount,
          wallet_used_amount,
          payable_amount,
          cashback_amount,
          cashback_status,
          created_at,
          updated_at
        FROM orders
        WHERE user_id = ?
        ORDER BY created_at DESC
      `)
      .bind(user.id)
      .all();

    return json({
      success: true,
      orders: orders.results || []
    });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}