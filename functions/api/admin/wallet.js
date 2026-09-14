import { requireAdmin, logAdminAction } from "../../lib/admin";
import { sendUserWalletNotification } from "../../lib/notification.js";
import { getEmailSettings } from "../../lib/email.js";
import { getCashbackSettings } from "../../lib/cashback.js";
import {
  expireCashbackForUser,
  getWalletBreakdown,
  consumeCashbackFirst
} from "../../lib/cashback-balance.js";

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
  if (["credit", "debit", "cashback", "refund", "adjustment"].includes(type)) return type;
  return "";
}

function getSignedAmountByType(type, amount) {
  if (type === "debit") return -Math.abs(amount);
  return Math.abs(amount);
}

function normalizeStatuses(input) {
  let list = [];
  if (Array.isArray(input)) list = input;
  else if (typeof input === "string") list = input.split(",");

  const normalized = list
    .map((item) => normalizeText(item).toLowerCase())
    .filter(Boolean);

  return normalized.length ? [...new Set(normalized)] : ["completed"];
}

function normalizeEligibilityMode(value) {
  const mode = normalizeText(value).toLowerCase();
  return ["all", "vip", "selected"].includes(mode) ? mode : "all";
}

function normalizeSelectedUserIds(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(
    list
      .map((item) => Number(String(item).trim()))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];
}

function formatTransactionRow(row) {
  return {
    ...row,
    amount: toMoney(row.amount),
    balance_before: toMoney(row.balance_before),
    balance_after: toMoney(row.balance_after),
    remaining_amount: row.remaining_amount == null ? null : toMoney(row.remaining_amount)
  };
}

async function sendWalletNotification(env, userId, transactionData, userData) {
  try {
    let eventType = "wallet_credit";
    const type = transactionData.type || "";

    if (type === "debit") eventType = "wallet_debit";
    else if (type === "cashback") eventType = "cashback_applied";
    else if (type === "refund") eventType = "refund_applied";

    const emailResult = await sendUserWalletNotification(
      env,
      userId,
      eventType,
      transactionData,
      userData
    );

    return { success: emailResult?.success || false, email: emailResult };
  } catch (error) {
    console.error("sendWalletNotification error:", error);
    return { success: false, error: String(error?.message || error) };
  }
}

export async function onRequestGet(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const db = context.env.DB;
    await ensureWalletTables(db);

    const url = new URL(context.request.url);
    const search = normalizeText(url.searchParams.get("search"));
    const userId = Number(
      url.searchParams.get("user_id") ||
      url.searchParams.get("userId") ||
      0
    );

    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") || 50), 1),
      200
    );

    const settings = await getCashbackSettings(db);

    if ((search || url.searchParams.get("view") === "users") && userId <= 0) {
      const pattern = `%${search}%`;
      const users = await db.prepare(`
        SELECT id, full_name, email, phone, role,
          COALESCE(wallet_balance, 0) AS wallet_balance
        FROM users
        WHERE full_name LIKE ? OR email LIKE ? OR phone LIKE ? OR CAST(id AS TEXT) LIKE ?
        ORDER BY id DESC
        LIMIT ?
      `).bind(pattern, pattern, pattern, pattern, limit).all();

      return json({
        success: true,
        settings,
        users: (users?.results || []).map((user) => ({
          ...user,
          wallet_balance: toMoney(user.wallet_balance)
        }))
      });
    }

    if (userId > 0) {
      await expireCashbackForUser(db, userId);

      const user = await db
        .prepare(`
          SELECT id, full_name, email, phone, role,
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

      const breakdown = await getWalletBreakdown(db, userId);

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
            remaining_amount,
            expires_at,
            expired_at,
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
        settings,
        user: {
          ...user,
          wallet_balance: breakdown.wallet_balance,
          cashback_balance: breakdown.cashback_balance,
          permanent_balance: breakdown.permanent_balance
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
          wt.remaining_amount,
          wt.expires_at,
          wt.expired_at,
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
      settings,
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
        Math.min(Number(pickFirst(body?.cashback_percent, body?.cashbackPercent, 0)) || 0, 100)
      );
      const cashbackStatuses = normalizeStatuses(
        pickFirst(body?.cashback_statuses, body?.cashbackStatuses, "completed")
      );
      const cashbackEnabled = body?.cashback_enabled === false || String(body?.cashback_enabled) === "0" ? 0 : 1;
      const minOrderAmount = Math.max(0, toMoney(body?.cashback_min_order_amount));
      const maxPerOrder = Math.max(0, toMoney(body?.cashback_max_per_order));
      const eligibilityMode = normalizeEligibilityMode(body?.cashback_eligibility_mode);
      const selectedUserIds = normalizeSelectedUserIds(body?.cashback_selected_user_ids);
      const expiryMonths = Math.min(12, Math.max(0, Math.round(Number(body?.cashback_expiry_months ?? 6) || 0)));

      await Promise.all([
        setSetting(db, "cashback_enabled", String(cashbackEnabled)),
        setSetting(db, "cashback_percent", String(cashbackPercent)),
        setSetting(db, "cashback_statuses", cashbackStatuses.join(",")),
        setSetting(db, "cashback_min_order_amount", String(minOrderAmount)),
        setSetting(db, "cashback_max_per_order", String(maxPerOrder)),
        setSetting(db, "cashback_eligibility_mode", eligibilityMode),
        setSetting(db, "cashback_selected_user_ids", selectedUserIds.join(",")),
        setSetting(db, "cashback_expiry_months", String(expiryMonths))
      ]);

      const settings = await getCashbackSettings(db);

      await logAdminAction(context, {
        admin_user_id: adminCheck.user.id,
        action: "wallet_save_settings",
        target_type: "wallet_settings",
        target_id: "cashback",
        description: `enabled=${cashbackEnabled}, percent=${cashbackPercent}, min=${minOrderAmount}, max=${maxPerOrder}, mode=${eligibilityMode}, expiry=${expiryMonths}`
      });

      return json({ success: true, settings });
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

    await expireCashbackForUser(db, userId);

    const user = await db
      .prepare(`
        SELECT id, full_name, email, phone,
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

    if (type === "debit") {
      await consumeCashbackFirst(db, userId, amount);
    }

    const transactionData = {
      id: null,
      type,
      amount: signedAmount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      note: note || null,
      source,
      reference_type: referenceType,
      reference_id: referenceId || null,
      order_id: orderId,
      order_number: orderNumber || null,
      created_at: new Date().toISOString()
    };

    const userData = {
      id: user.id,
      fullName: user.full_name || "",
      email: user.email || "",
      phone: user.phone || ""
    };

    context.waitUntil(
      (async () => {
        try {
          const emailSettings = await getEmailSettings(context.env);
          if (emailSettings.is_enabled && user.email) {
            await sendWalletNotification(
              context.env,
              userId,
              transactionData,
              userData
            );
          }
        } catch (notifError) {
          console.error("Wallet email notification error:", notifError);
        }
      })()
    );

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
