import { getCurrentUser } from "../../lib/admin";
import { getCashbackSettings, isCashbackEligible } from "../../lib/cashback.js";
import { expireCashbackForUser, getWalletBreakdown } from "../../lib/cashback-balance.js";

function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function onRequestGet(context) {
  try {
    const user = await getCurrentUser(context);
    if (!user) return json({ success: false, error: "unauthorized" }, 401);

    await expireCashbackForUser(context.env.DB, user.id);

    const settings = await getCashbackSettings(context.env.DB);
    const breakdown = await getWalletBreakdown(context.env.DB, user.id);
    const transactionsQuery = await context.env.DB.prepare(`
      SELECT id, type, amount, balance_before, balance_after, status, source,
             reference_type, reference_id, note, order_id, order_number,
             remaining_amount, expires_at, expired_at, created_by_user_id, created_at
      FROM wallet_transactions
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 100
    `).bind(user.id).all();

    const transactions = (transactionsQuery?.results || []).map((tx) => ({
      ...tx,
      id: Number(tx.id || 0),
      amount: Number(tx.amount || 0),
      balance_before: Number(tx.balance_before || 0),
      balance_after: Number(tx.balance_after || 0),
      remaining_amount: tx.remaining_amount == null ? null : Number(tx.remaining_amount || 0)
    }));

    const eligible = isCashbackEligible(settings, user);

    return json({
      success: true,
      user: {
        id: Number(user.id || 0),
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        role: user.role || "customer",
        wallet_balance: breakdown.wallet_balance,
        cashback_balance: breakdown.cashback_balance,
        permanent_balance: breakdown.permanent_balance
      },
      wallet_balance: breakdown.wallet_balance,
      cashback_balance: breakdown.cashback_balance,
      permanent_balance: breakdown.permanent_balance,
      cashback_percent: Number(settings.cashback_percent || 0),
      cashback_eligible: eligible,
      settings: { ...settings, cashback_eligible: eligible },
      transactions
    });
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}
