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
  const sessionId = getCookie(request.headers.get("cookie") || "", "session_id");
  if (!sessionId) return null;

  return await env.DB.prepare(`
    SELECT
      id,
      full_name,
      email,
      phone,
      role,
      COALESCE(wallet_balance, 0) AS wallet_balance
    FROM users
    WHERE id = (
      SELECT user_id
      FROM sessions
      WHERE id = ?
      LIMIT 1
    )
    LIMIT 1
  `).bind(sessionId).first();
}

async function getWalletSettings(env) {
  const rows = await env.DB.prepare(`
    SELECT key, value
    FROM site_settings
    WHERE key IN ('cashback_percent', 'cashback_statuses')
  `).all();

  const list = Array.isArray(rows?.results) ? rows.results : [];

  const settingsMap = {};
  for (const row of list) {
    settingsMap[String(row.key || "").trim()] = row.value;
  }

  let cashbackPercent = Number(settingsMap.cashback_percent || 0);
  if (!Number.isFinite(cashbackPercent) || cashbackPercent < 0) {
    cashbackPercent = 0;
  }

  let cashbackStatuses = ["completed"];
  const rawStatuses = settingsMap.cashback_statuses;

  if (rawStatuses) {
    try {
      const parsed = JSON.parse(rawStatuses);
      if (Array.isArray(parsed)) {
        cashbackStatuses = parsed
          .map((item) => String(item || "").trim().toLowerCase())
          .filter(Boolean);
      } else {
        cashbackStatuses = String(rawStatuses)
          .split(",")
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean);
      }
    } catch (_) {
      cashbackStatuses = String(rawStatuses)
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    }
  }

  if (!cashbackStatuses.length) {
    cashbackStatuses = ["completed"];
  }

  return {
    cashback_percent: cashbackPercent,
    cashback_statuses: cashbackStatuses
  };
}

export async function onRequestGet(context) {
  try {
    const user = await getCurrentUser(context.request, context.env);

    if (!user) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

    const [transactionsQuery, settings] = await Promise.all([
      context.env.DB.prepare(`
        SELECT
          id,
          type,
          amount,
          balance_before,
          balance_after,
          status,
          source,
          description,
          note,
          order_id,
          order_number,
          reference_type,
          reference_id,
          created_at,
          updated_at
        FROM wallet_transactions
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 100
      `).bind(user.id).all(),
      getWalletSettings(context.env)
    ]);

    const transactions = Array.isArray(transactionsQuery?.results)
      ? transactionsQuery.results.map((tx) => ({
          id: Number(tx.id || 0),
          type: tx.type || "",
          amount: Number(tx.amount || 0),
          balance_before: Number(tx.balance_before || 0),
          balance_after: Number(tx.balance_after || 0),
          status: tx.status || "",
          source: tx.source || "",
          description: tx.description || "",
          note: tx.note || "",
          order_id: tx.order_id ? Number(tx.order_id) : null,
          order_number: tx.order_number || "",
          reference_type: tx.reference_type || "",
          reference_id: tx.reference_id || "",
          created_at: tx.created_at || null,
          updated_at: tx.updated_at || null
        }))
      : [];

    return json({
      success: true,
      user: {
        id: Number(user.id || 0),
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        role: user.role || "user",
        wallet_balance: Number(user.wallet_balance || 0)
      },
      wallet_balance: Number(user.wallet_balance || 0),
      cashback_percent: Number(settings.cashback_percent || 0),
      settings: {
        cashback_percent: Number(settings.cashback_percent || 0),
        cashback_statuses: settings.cashback_statuses
      },
      transactions
    });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}