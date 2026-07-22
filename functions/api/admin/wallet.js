import { requireAdmin, logAdminAction } from "../../lib/admin";

function json(data, status = 200) {
  return Response.json(data, { status });
}

function toMoney(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function normalizeText(value) {
  return String(value || "").trim();
}

async function ensureWalletTables(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_before INTEGER NOT NULL DEFAULT 0,
      balance_after INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed',
      source TEXT,
      description TEXT,
      order_id INTEGER,
      order_number TEXT,
      admin_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT NOT NULL UNIQUE,
      setting_value TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

async function getSetting(db, key, fallback = null) {
  const row = await db
    .prepare(`SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1`)
    .bind(key)
    .first();
  return row ? row.setting_value : fallback;
}

async function setSetting(db, key, value) {
  await db
    .prepare(`
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(setting_key) DO UPDATE SET
        setting_value = excluded.setting_value,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(key, String(value))
    .run();
}

export async function onRequestGet(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    await ensureWalletTables(context.env.DB);

    const url = new URL(context.request.url);
    const userId = Number(url.searchParams.get("user_id") || 0);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200);

    const cashbackPercent = Number(await getSetting(context.env.DB, "cashback_percent", "0")) || 0;
    const cashbackStatuses = String(await getSetting(context.env.DB, "cashback_statuses", "completed,processing"))
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);

    if (userId > 0) {
      const user = await context.env.DB
        .prepare(`
          SELECT id, full_name, email, phone, role, COALESCE(wallet_balance, 0) AS wallet_balance
          FROM users
          WHERE id = ?
          LIMIT 1
        `)
        .bind(userId)
        .first();

      if (!user) {
        return json({ success: false, error: "user not found" }, 404);
      }

      const txns = await context.env.DB
        .prepare(`
          SELECT
            id, user_id, type, amount, balance_before, balance_after, status,
            source, description, order_id, order_number, admin_user_id, created_at
          FROM wallet_transactions
          WHERE user_id = ?
          ORDER BY id DESC
          LIMIT ?
        `)
        .bind(userId, limit)
        .all();

      return json({
        success: true,
        settings: {
          cashback_percent: cashbackPercent,
          cashback_statuses: cashbackStatuses
        },
        user,
        transactions: txns.results || []
      });
    }

    const latest = await context.env.DB
      .prepare(`
        SELECT
          wt.id, wt.user_id, wt.type, wt.amount, wt.balance_before, wt.balance_after,
          wt.status, wt.source, wt.description, wt.order_id, wt.order_number,
          wt.admin_user_id, wt.created_at,
          u.full_name, u.email
        FROM wallet_transactions wt
        JOIN users u ON u.id = wt.user_id
        ORDER BY wt.id DESC
        LIMIT ?
      `)
      .bind(limit)
      .all();

    return json({
      success: true,
      settings: {
        cashback_percent: cashbackPercent,
        cashback_statuses: cashbackStatuses
      },
      transactions: latest.results || []
    });
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    await ensureWalletTables(context.env.DB);

    const body = await context.request.json();
    const action = normalizeText(body.action);

    if (action === "save_settings") {
      const cashbackPercent = Math.max(0, Math.min(Number(body.cashback_percent || 0), 100));
      const cashbackStatuses = Array.isArray(body.cashback_statuses)
        ? body.cashback_statuses.map((s) => normalizeText(s).toLowerCase()).filter(Boolean)
        : ["completed", "processing"];

      await setSetting(context.env.DB, "cashback_percent", String(cashbackPercent));
      await setSetting(context.env.DB, "cashback_statuses", cashbackStatuses.join(","));

      await logAdminAction(context, {
        admin_user_id: adminCheck.user.id,
        action: "wallet_save_settings",
        target_type: "wallet_settings",
        target_id: "cashback",
        description: `cashback_percent=${cashbackPercent}, statuses=${cashbackStatuses.join(",")}`
      });

      return json({
        success: true,
        settings: {
          cashback_percent: cashbackPercent,
          cashback_statuses: cashbackStatuses
        }
      });
    }

    const userId = Number(body.user_id || 0);
    const amount = toMoney(body.amount);
    const type = normalizeText(body.type || "manual_credit").toLowerCase();
    const description = normalizeText(body.description);

    if (!userId || amount <= 0) {
      return json({ success: false, error: "user_id and amount required" }, 400);
    }

    if (!["manual_credit", "manual_debit"].includes(type)) {
      return json({ success: false, error: "invalid type" }, 400);
    }

    const user = await context.env.DB
      .prepare(`SELECT id, full_name, email, COALESCE(wallet_balance, 0) AS wallet_balance FROM users WHERE id = ?`)
      .bind(userId)
      .first();

    if (!user) {
      return json({ success: false, error: "user not found" }, 404);
    }

    const balanceBefore = Number(user.wallet_balance || 0);
    const signedAmount = type === "manual_debit" ? -amount : amount;
    const balanceAfter = balanceBefore + signedAmount;

    if (balanceAfter < 0) {
      return json({ success: false, error: "insufficient wallet balance" }, 400);
    }

    await context.env.DB.batch([
      context.env.DB
        .prepare(`UPDATE users SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(balanceAfter, userId),
      context.env.DB
        .prepare(`
          INSERT INTO wallet_transactions (
            user_id, type, amount, balance_before, balance_after,
            status, source, description, admin_user_id, created_at
          )
          VALUES (?, ?, ?, ?, ?, 'completed', 'admin', ?, ?, CURRENT_TIMESTAMP)
        `)
        .bind(userId, type, signedAmount, balanceBefore, balanceAfter, description || null, adminCheck.user.id)
    ]);

    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: type,
      target_type: "wallet",
      target_id: String(userId),
      description: `amount=${signedAmount}, balance_after=${balanceAfter}`
    });

    return json({
      success: true,
      user_id: userId,
      balance_before: balanceBefore,
      balance_after: balanceAfter
    });
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}