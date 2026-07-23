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

function normalizeStatuses(rawValue) {
  if (!rawValue) return ["completed"];

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      const list = parsed
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean);
      return list.length ? list : ["completed"];
    }
  } catch (_) {}

  const list = String(rawValue)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return list.length ? list : ["completed"];
}

async function getWalletSettings(env) {
  const defaults = {
    cashback_percent: 0,
    cashback_statuses: ["completed"]
  };

  const attempts = [
    {
      table: "site_settings",
      keyColumn: "key",
      valueColumn: "value"
    },
    {
      table: "app_settings",
      keyColumn: "key",
      valueColumn: "value"
    }
  ];

  for (const attempt of attempts) {
    try {
      const rows = await env.DB.prepare(`
        SELECT ${attempt.keyColumn} AS setting_key, ${attempt.valueColumn} AS setting_value
        FROM ${attempt.table}
        WHERE ${attempt.keyColumn} IN ('cashback_percent', 'cashback_statuses')
      `).all();

      const results = Array.isArray(rows?.results) ? rows.results : [];
      if (!results.length) {
        return defaults;
      }

      const map = {};
      for (const row of results) {
        map[String(row?.setting_key || "").trim()] = row?.setting_value;
      }

      let cashbackPercent = Number(map.cashback_percent || 0);
      if (!Number.isFinite(cashbackPercent) || cashbackPercent < 0) {
        cashbackPercent = 0;
      }

      return {
        cashback_percent: cashbackPercent,
        cashback_statuses: normalizeStatuses(map.cashback_statuses)
      };
    } catch (error) {
      const message = String(error?.message || error || "");
      const ignorable =
        message.includes("no such table") ||
        message.includes("no such column");

      if (!ignorable) {
        throw error;
      }
    }
  }

  return defaults;
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
          reference_type,
          reference_id,
          note,
          created_by_user_id,
          created_at
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
          reference_type: tx.reference_type || "",
          reference_id: tx.reference_id || "",
          note: tx.note || "",
          created_by_user_id: tx.created_by_user_id ? Number(tx.created_by_user_id) : null,
          created_at: tx.created_at || null
        }))
      : [];

    return json({
      success: true,
      user: {
        id: Number(user.id || 0),
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        role: user.role || "customer",
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