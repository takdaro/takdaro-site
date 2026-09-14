function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

export async function expireCashbackForUser(db, userId) {
  const id = Number(userId || 0);
  if (!id) return 0;

  const expired = await db.prepare(`
    SELECT COALESCE(SUM(remaining_amount), 0) AS amount
    FROM wallet_transactions
    WHERE user_id = ?
      AND type = 'cashback'
      AND status = 'completed'
      AND COALESCE(remaining_amount, 0) > 0
      AND expires_at IS NOT NULL
      AND expires_at <= CURRENT_TIMESTAMP
  `).bind(id).first();

  const amount = money(expired?.amount || 0);
  if (!amount) return 0;

  await db.batch([
    db.prepare(`
      UPDATE users
      SET wallet_balance = MAX(0, COALESCE(wallet_balance, 0) - ?),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(amount, id),
    db.prepare(`
      UPDATE wallet_transactions
      SET remaining_amount = 0,
          expired_at = COALESCE(expired_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
        AND type = 'cashback'
        AND status = 'completed'
        AND COALESCE(remaining_amount, 0) > 0
        AND expires_at IS NOT NULL
        AND expires_at <= CURRENT_TIMESTAMP
    `).bind(id)
  ]);

  return amount;
}

export async function getWalletBreakdown(db, userId) {
  const id = Number(userId || 0);
  if (!id) return { total_balance: 0, permanent_balance: 0, cashback_balance: 0, nearest_cashback_expiry: null };

  await expireCashbackForUser(db, id);
  const user = await db.prepare(`SELECT COALESCE(wallet_balance,0) AS balance FROM users WHERE id=? LIMIT 1`).bind(id).first();
  const cb = await db.prepare(`
    SELECT COALESCE(SUM(remaining_amount),0) AS balance, MIN(expires_at) AS nearest_expiry
    FROM wallet_transactions
    WHERE user_id=? AND type='cashback' AND status='completed'
      AND COALESCE(remaining_amount,0)>0 AND expired_at IS NULL
      AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)
  `).bind(id).first();

  const total = money(user?.balance || 0);
  const cashback = Math.min(total, money(cb?.balance || 0));
  return {
    total_balance: total,
    permanent_balance: Math.max(0, total - cashback),
    cashback_balance: cashback,
    nearest_cashback_expiry: cb?.nearest_expiry || null
  };
}
