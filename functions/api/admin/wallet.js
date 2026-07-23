import { requireAdmin, logAdminAction } from "../../lib/admin";

function json(data, status = 200) {
  return Response.json(data, { status });
}

function toMoney(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
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
      note TEXT,
      order_id INTEGER,
      order_number TEXT,
      reference_type TEXT,
      reference_id TEXT,
      created_by_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

function normalizeWalletType(value) {
  const type = normalizeText(value).toLowerCase();

  if (type === "manual_credit") return "credit";
  if (type === "manual_debit") return "debit";

  if (["credit", "debit", "cashback", "refund", "adjustment"].includes(type)) {
    return type;
  }

  return "";
}

function getSignedAmountByType(type, amount) {
  if (type === "debit") return -Math.abs(amount);
  return Math.abs(amount);
}

function normalizeStatuses(input) {
  let list = [];

  if (Array.isArray(input)) {
    list = input;
  } else if (typeof input === "string") {
    list = input.split(",");
  }

  const normalized = list
    .map((item) => normalizeText(item).toLowerCase())
    .filter(Boolean);

  return normalized.length ? [...new Set(normalized)] : ["completed"];
}

function formatTransactionRow(row) {
  return {
    ...row,
    amount: toMoney(row.amount),
    balance_before: toMoney(row.balance_before),
    balance_after: toMoney(row.balance_after)
  };
}

function buildSettingsPayload(cashbackPercent, cashbackStatuses) {
  return {
    cashback_percent: Number(cashbackPercent) || 0,
    cashback_statuses: Array.isArray(cashbackStatuses) ? cashbackStatuses : ["completed"]
  };
}

export async function onRequestGet(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const db = context.env.DB;
    await ensureWalletTables(db);

    const url = new URL(context.request.url);
    const userId = Number(
      url.searchParams.get("user_id") ||
      url.searchParams.get("userId") ||
      0
    );

    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") || 50), 1),
      200
    );

    const cashbackPercent = Number(await getSetting(db, "cashback_percent", "0")) || 0;
    const cashbackStatuses = normalizeStatuses(
      await getSetting(db, "cashback_statuses", "completed")
    );

    if (userId > 0) {
      const user = await db
        .prepare(`
          SELECT
            id,
            full_name,
            email,
            phone,
            role,
            COALESCE(wallet_balance, 0) AS wallet_balance
          FROM users
          WHERE id = ?
          LIMIT 1
        `)
        .bind(userId)
        .first();

      if (!user) {
        return json({ success: false, error: "user_not_found" }, 404);
      }

      const txns = await db
        .prepare(`
          SELECT
            id,
            user_id,
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
            created_by_user_id,
            created_at,
            updated_at
          FROM wallet_transactions
          WHERE user_id = ?
          ORDER BY id DESC
          LIMIT ?
        `)
        .bind(userId, limit)
        .all();

      return json({
        success: true,
        settings: buildSettingsPayload(cashbackPercent, cashbackStatuses),
        user: {
          ...user,
          wallet_balance: toMoney(user.wallet_balance)
        },
        transactions: (txns?.results || []).map(formatTransactionRow)
      });
    }

    const latest = await db
      .prepare(`
        SELECT
          wt.id,
          wt.user_id,
          wt.type,
          wt.amount,
          wt.balance_before,
          wt.balance_after,
          wt.status,
          wt.source,
          wt.description,
          wt.note,
          wt.order_id,
          wt.order_number,
          wt.reference_type,
          wt.reference_id,
          wt.created_by_user_id,
          wt.created_at,
          wt.updated_at,
          u.full_name,
          u.email
        FROM wallet_transactions wt
        JOIN users u ON u.id = wt.user_id
        ORDER BY wt.id DESC
        LIMIT ?
      `)
      .bind(limit)
      .all();

    return json({
      success: true,
      settings: buildSettingsPayload(cashbackPercent, cashbackStatuses),
      transactions: (latest?.results || []).map(formatTransactionRow)
    });
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const db = context.env.DB;
    await ensureWalletTables(db);

    const body = await context.request.json().catch(() => null);
    const action = normalizeText(body?.action).toLowerCase();

    if (action === "save_settings") {
      const cashbackPercent = Math.max(
        0,
        Math.min(
          Number(
            pickFirst(body?.cashback_percent, body?.cashbackPercent, 0)
          ) || 0,
          100
        )
      );

      const cashbackStatuses = normalizeStatuses(
        pickFirst(body?.cashback_statuses, body?.cashbackStatuses, "completed")
      );

      await setSetting(db, "cashback_percent", String(cashbackPercent));
      await setSetting(db, "cashback_statuses", cashbackStatuses.join(","));

      await logAdminAction(context, {
        admin_user_id: adminCheck.user.id,
        action: "wallet_save_settings",
        target_type: "wallet_settings",
        target_id: "cashback",
        description: `cashback_percent=${cashbackPercent}, statuses=${cashbackStatuses.join(",")}`
      });

      return json({
        success: true,
        settings: buildSettingsPayload(cashbackPercent, cashbackStatuses)
      });
    }

    const userId = Number(pickFirst(body?.user_id, body?.userId, 0) || 0);
    const amount = Math.abs(toMoney(body?.amount));
    const type = normalizeWalletType(pickFirst(body?.type, "credit"));
    const note = normalizeText(pickFirst(body?.note, body?.description));
    const source = normalizeText(
      pickFirst(body?.source, body?.reference_type, body?.referenceType, "admin")
    ).toLowerCase() || "admin";

    const referenceType = normalizeText(
      pickFirst(body?.reference_type, body?.referenceType, source, "admin")
    ).toLowerCase() || "admin";

    const referenceId = normalizeText(
      pickFirst(body?.reference_id, body?.referenceId, body?.reference)
    );

    const orderIdRaw = pickFirst(body?.order_id, body?.orderId, 0);
    const orderId = Number(orderIdRaw || 0) || null;

    const orderNumber = normalizeText(
      pickFirst(body?.order_number, body?.orderNumber)
    );

    if (!userId || amount <= 0) {
      return json({ success: false, error: "user_id_and_amount_required" }, 400);
    }

    if (!type) {
      return json({ success: false, error: "invalid_type" }, 400);
    }

    const user = await db
      .prepare(`
        SELECT
          id,
          full_name,
          email,
          COALESCE(wallet_balance, 0) AS wallet_balance
        FROM users
        WHERE id = ?
        LIMIT 1
      `)
      .bind(userId)
      .first();

    if (!user) {
      return json({ success: false, error: "user_not_found" }, 404);
    }

    const balanceBefore = toMoney(user.wallet_balance);
    const signedAmount = getSignedAmountByType(type, amount);
    const balanceAfter = balanceBefore + signedAmount;

    if (balanceAfter < 0) {
      return json({ success: false, error: "insufficient_wallet_balance" }, 400);
    }

    await db.batch([
      db.prepare(`
        UPDATE users
        SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(balanceAfter, userId),

      db.prepare(`
        INSERT INTO wallet_transactions (
          user_id,
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
          created_by_user_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        userId,
        type,
        signedAmount,
        balanceBefore,
        balanceAfter,
        source,
        note || `${type} wallet transaction`,
        note || null,
        orderId,
        orderNumber || null,
        referenceType,
        referenceId || null,
        adminCheck.user.id
      )
    ]);

    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: `wallet_${type}`,
      target_type: "wallet",
      target_id: String(userId),
      description: `amount=${signedAmount}, balance_after=${balanceAfter}, source=${source}, reference_type=${referenceType}`
    });

    return json({
      success: true,
      transaction: {
        user_id: userId,
        type,
        amount: signedAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: "completed",
        source,
        note: note || null,
        reference_type: referenceType,
        reference_id: referenceId || null,
        order_id: orderId,
        order_number: orderNumber || null,
        created_by_user_id: adminCheck.user.id
      }
    });
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}