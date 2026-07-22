import { requireAdmin } from "../../lib/admin";

export async function onRequestGet(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const [usersCount, ordersCount, pendingOrders, revenueSum, walletSum, latestUsers, latestOrders] =
      await context.env.DB.batch([
        context.env.DB.prepare(`SELECT COUNT(*) AS count FROM users`),
        context.env.DB.prepare(`SELECT COUNT(*) AS count FROM orders`),
        context.env.DB.prepare(`SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'`),
        context.env.DB.prepare(`
          SELECT COALESCE(SUM(total_amount), 0) AS total
          FROM orders
          WHERE payment_status IN ('paid', 'completed', 'success')
        `),
        context.env.DB.prepare(`
          SELECT COALESCE(SUM(wallet_balance), 0) AS total
          FROM users
        `),
        context.env.DB.prepare(`
          SELECT id, full_name, email, role, created_at
          FROM users
          ORDER BY id DESC
          LIMIT 5
        `),
        context.env.DB.prepare(`
          SELECT order_number, status, payment_status, total_amount, created_at
          FROM orders
          ORDER BY id DESC
          LIMIT 5
        `)
      ]);

    return Response.json({
      success: true,
      stats: {
        total_users: usersCount.results?.[0]?.count || 0,
        total_orders: ordersCount.results?.[0]?.count || 0,
        pending_orders: pendingOrders.results?.[0]?.count || 0,
        total_revenue: revenueSum.results?.[0]?.total || 0,
        total_wallet_balance: walletSum.results?.[0]?.total || 0
      },
      latest_users: latestUsers.results || [],
      latest_orders: latestOrders.results || []
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}