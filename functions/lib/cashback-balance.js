function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

export async function expireCashbackForUser(db, userId) {
  const id = Number(userId || 0);
  if (!id) return 0;

  const row = await db.prepare(`
    SELECT COALESCE(SUM(remaining_amount), 0) AS amount
    FROM wallet_transactions
    WHERE user_id = ? AND type = 'cashback' AND status = 'completed'
      AND COALESCE(remaining_amount, 0) > 0
      AND expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
  `).bind(id).first();

  const amount = money(row?.amount);
  if (!amount) return 0;

  await db.batch([
    db.prepare(`UPDATE users SET wallet_balance = MAX(0, COALESCE(wallet_balance, 0) - ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(amount, id),
    db.prepare(`UPDATE wallet_transactions SET remaining_amount = 0, expired_at = COALESCE(expired_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND type = 'cashback' AND status = 'completed' AND COALESCE(remaining_amount, 0) > 0 AND expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP`).bind(id)
  ]);

  return amount;
}

export async function getWalletBreakdown(db, userId) {
  const id = Number(userId || 0);
  if (!id) return { wallet_balance: 0, cashback_balance: 0, permanent_balance: 0 };

  const user = await db.prepare(`SELECT COALESCE(wallet_balance, 0) AS balance FROM users WHERE id = ? LIMIT 1`).bind(id).first();
  const cb = await db.prepare(`SELECT COALESCE(SUM(remaining_amount), 0) AS balance FROM wallet_transactions WHERE user_id = ? AND type = 'cashback' AND status = 'completed' AND COALESCE(remaining_amount, 0) > 0 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`).bind(id).first();

  const wallet = money(user?.balance);
  const cashback = Math.min(wallet, money(cb?.balance));
  return {
    wallet_balance: wallet,
    cashback_balance: cashback,
    permanent_balance: Math.max(0, wallet - cashback)
  };
}

export async function consumeCashbackFirst(db, userId, amount) {
  const id = Number(userId || 0);
  let need = money(amount);
  if (!id || !need) return;

  const rows = await db.prepare(`
    SELECT id, COALESCE(remaining_amount, 0) AS amount
    FROM wallet_transactions
    WHERE user_id = ? AND type = 'cashback' AND status = 'completed'
      AND COALESCE(remaining_amount, 0) > 0
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ORDER BY CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END, expires_at, id
  `).bind(id).all();

  for (const row of rows?.results || []) {
    if (need <= 0) break;
    const used = Math.min(need, money(row.amount));
    if (!used) continue;
    await db.prepare(`UPDATE wallet_transactions SET remaining_amount = MAX(0, COALESCE(remaining_amount, 0) - ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(used, row.id).run();
    need -= used;
  }
}
