function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

async function getCurrentUser(request, env) {
  const sessionId = getCookie(request.headers.get("cookie"), "session_id");
  if (!sessionId) return null;

  return await env.DB.prepare(`
    SELECT id, full_name, email, phone, role, COALESCE(wallet_balance, 0) AS wallet_balance
    FROM users
    WHERE id = (
      SELECT user_id FROM sessions WHERE id = ? LIMIT 1
    )
    LIMIT 1
  `).bind(sessionId).first();
}

export async function onRequestGet(context) {
  try {
    const user = await getCurrentUser(context.request, context.env);
    if (!user) return json({ success: false, error: "Unauthorized" }, 401);

    const rows = await context.env.DB.prepare(`
      SELECT
        id, type, amount, balance_before, balance_after, status,
        source, description, order_id, order_number, created_at
      FROM wallet_transactions
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 100
    `).bind(user.id).all();

    return json({
      success: true,
      wallet_balance: Number(user.wallet_balance || 0),
      transactions: rows.results || []
    });
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}