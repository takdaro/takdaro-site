CREATE TRIGGER IF NOT EXISTS trg_cashback_reversal_protect_permanent
AFTER INSERT ON wallet_transactions
WHEN NEW.type='debit' AND NEW.source='cashback_reversal' AND NEW.status='completed'
BEGIN
  UPDATE users
  SET wallet_balance = wallet_balance + MAX(0, ABS(COALESCE(NEW.amount,0)) - COALESCE((
    SELECT remaining_amount FROM wallet_transactions
    WHERE user_id=NEW.user_id AND order_id=NEW.order_id AND type='cashback' AND status='completed'
    ORDER BY id DESC LIMIT 1
  ),0))
  WHERE id=NEW.user_id;

  UPDATE wallet_transactions
  SET amount = MIN(ABS(COALESCE(NEW.amount,0)), COALESCE((
        SELECT remaining_amount FROM wallet_transactions
        WHERE user_id=NEW.user_id AND order_id=NEW.order_id AND type='cashback' AND status='completed'
        ORDER BY id DESC LIMIT 1
      ),0)),
      balance_after = COALESCE((SELECT wallet_balance FROM users WHERE id=NEW.user_id), balance_after)
  WHERE id=NEW.id;

  UPDATE wallet_transactions
  SET remaining_amount=0
  WHERE user_id=NEW.user_id AND order_id=NEW.order_id AND type='cashback' AND status='completed';
END;
