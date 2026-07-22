import { requireAdmin, logAdminAction } from "../../lib/admin";

async function ensureWalletTransactionsTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_before INTEGER NOT NULL DEFAULT 0,
      balance_after INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed',
      reference_type TEXT,
      reference_id TEXT,
      note TEXT,
      created_by_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

export async function onRequestGet(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    await ensureWalletTransactionsTable(context.env.DB);

    const url = new URL(context.request.url);
    const userId = Number(url.searchParams.get("user_id") || 0);

    if (!userId) {
      return Response.json(
        { success: false, error: "user_id required" },
        { status: 400 }
      );
    }

    const user = await context.env.DB
      .prepare(`
        SELECT id, full_name, email, phone, role, COALESCE(wallet_balance, 0) AS wallet_balance
        FROM users
        WHERE id = ?
      `)
      .bind(userId)
      .first();

    if (!user) {
      return Response.json(
        { success: false, error: "user not found" },
        { status: 404 }
      );
    }

    const txs = await context.env.DB
      .prepare(`
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
      `)
      .bind(userId)
      .all();

    return Response.json({
      success: true,
      user,
      transactions: txs.results || []
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}

export async function onRequestPost(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    await ensureWalletTransactionsTable(context.env.DB);

    const body = await context.request.json();
    const user_id = Number(body.user_id || 0);
    const type = String(body.type || "").trim().toLowerCase();
    const amount = Number(body.amount || 0);
    const note = String(body.note || "").trim();
    const reference_type = String(body.reference_type || "admin").trim();
    const reference_id = String(body.reference_id || "").trim();

    if (!user_id || !["credit", "debit"].includes(type) || !Number.isFinite(amount) || amount <= 0) {
      return Response.json(
        { success: false, error: "invalid wallet payload" },
        { status: 400 }
      );
    }

    const user = await context.env.DB
      .prepare(`SELECT id, wallet_balance FROM users WHERE id = ?`)
      .bind(user_id)
      .first();

    if (!user) {
      return Response.json(
        { success: false, error: "user not found" },
        { status: 404 }
      );
    }

    const before = Number(user.wallet_balance || 0);
    const delta = type === "credit" ? amount : -amount;
    const after = before + delta;

    if (after < 0) {
      return Response.json(
        { success: false, error: "insufficient wallet balance" },
        { status: 400 }
      );
    }

    await context.env.DB.batch([
      context.env.DB.prepare(`
        UPDATE users
        SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(after, user_id),

      context.env.DB.prepare(`
        INSERT INTO wallet_transactions
        (
          user_id,
          type,
          amount,
          balance_before,
          balance_after,
          status,
          reference_type,
          reference_id,
          note,
          created_by_user_id
        )
        VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
      `).bind(
        user_id,
        type,
        amount,
        before,
        after,
        reference_type || "admin",
        reference_id || null,
        note || null,
        adminCheck.user.id
      )
    ]);

    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: type === "credit" ? "wallet_credit" : "wallet_debit",
      target_type: "user",
      target_id: String(user_id),
      description: `${type} ${amount}${note ? ` | ${note}` : ""}`
    });

    const updated = await context.env.DB
      .prepare(`
        SELECT id, full_name, email, phone, role, COALESCE(wallet_balance, 0) AS wallet_balance
        FROM users
        WHERE id = ?
      `)
      .bind(user_id)
      .first();

    const latestTx = await context.env.DB
      .prepare(`
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
        LIMIT 1
      `)
      .bind(user_id)
      .first();

    return Response.json({
      success: true,
      user: updated,
      transaction: latestTx
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}