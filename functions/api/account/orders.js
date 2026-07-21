function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}

async function getCurrentUserId(context) {
  const cookieString = context.request.headers.get("Cookie") || "";
  const sessionId = getCookie(cookieString, "session_id");

  if (!sessionId) return null;

  const session = await context.env.DB
    .prepare("SELECT user_id FROM sessions WHERE id = ?")
    .bind(sessionId)
    .first();

  return session?.user_id ?? null;
}

export async function onRequestGet(context) {
  try {
    const userId = await getCurrentUserId(context);

    if (!userId) {
      return Response.json({ success: false, error: "unauthorized" }, { status: 401 });
    }

    const orders = await context.env.DB
      .prepare(`
        SELECT
          id,
          order_number,
          status,
          total_amount,
          shipping_amount,
          discount_amount,
          payment_status,
          created_at
        FROM orders
        WHERE user_id = ?
        ORDER BY created_at DESC
      `)
      .bind(userId)
      .all();

    return Response.json({
      success: true,
      orders: orders.results || []
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}