PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_enabled', '1');
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_min_order_amount', '0');
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_max_per_order', '0');
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_eligibility_mode', 'all');
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_selected_user_ids', '');
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_expiry_months', '6');

ALTER TABLE wallet_transactions ADD COLUMN remaining_amount INTEGER;
ALTER TABLE wallet_transactions ADD COLUMN expires_at TEXT;
ALTER TABLE wallet_transactions ADD COLUMN expired_at TEXT;

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_cashback_expiry
ON wallet_transactions(user_id, type, status, expires_at);

CREATE TRIGGER IF NOT EXISTS trg_wallet_cashback_expiry_init
AFTER INSERT ON wallet_transactions
WHEN NEW.type = 'cashback' AND NEW.status = 'completed'
BEGIN
  UPDATE wallet_transactions
  SET remaining_amount = ABS(COALESCE(NEW.amount, 0)),
      expires_at = CASE
        WHEN CAST(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_expiry_months'), '0') AS INTEGER) > 0
        THEN DATETIME(CURRENT_TIMESTAMP, '+' || CAST(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_expiry_months'), '0') AS INTEGER) || ' months')
        ELSE NULL
      END,
      expired_at = NULL
  WHERE id = NEW.id;
END;

-- The existing order API creates a cashback_reversal debit using the original
-- cashback amount. For phase-1 cashback rows, correct that debit to only the
-- still-unspent amount so permanent wallet credit is never removed.
CREATE TRIGGER IF NOT EXISTS trg_wallet_cashback_safe_reversal
AFTER INSERT ON wallet_transactions
WHEN NEW.type = 'debit'
  AND NEW.source = 'cashback_reversal'
  AND NEW.status = 'completed'
  AND EXISTS (
    SELECT 1
    FROM wallet_transactions cb
    WHERE cb.user_id = NEW.user_id
      AND cb.order_id = NEW.order_id
      AND cb.type = 'cashback'
      AND cb.status = 'completed'
      AND cb.remaining_amount IS NOT NULL
  )
BEGIN
  UPDATE users
  SET wallet_balance = MAX(
        0,
        COALESCE(wallet_balance, 0)
        + MAX(
            0,
            ABS(COALESCE(NEW.amount, 0))
            - COALESCE((
                SELECT cb.remaining_amount
                FROM wallet_transactions cb
                WHERE cb.user_id = NEW.user_id
                  AND cb.order_id = NEW.order_id
                  AND cb.type = 'cashback'
                  AND cb.status = 'completed'
                  AND cb.remaining_amount IS NOT NULL
                ORDER BY cb.id DESC
                LIMIT 1
              ), 0)
          )
      ),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.user_id;

  UPDATE wallet_transactions
  SET amount = COALESCE((
        SELECT cb.remaining_amount
        FROM wallet_transactions cb
        WHERE cb.user_id = NEW.user_id
          AND cb.order_id = NEW.order_id
          AND cb.type = 'cashback'
          AND cb.status = 'completed'
          AND cb.remaining_amount IS NOT NULL
        ORDER BY cb.id DESC
        LIMIT 1
      ), 0),
      balance_after = MAX(
        0,
        COALESCE(NEW.balance_before, 0)
        - COALESCE((
            SELECT cb.remaining_amount
            FROM wallet_transactions cb
            WHERE cb.user_id = NEW.user_id
              AND cb.order_id = NEW.order_id
              AND cb.type = 'cashback'
              AND cb.status = 'completed'
              AND cb.remaining_amount IS NOT NULL
            ORDER BY cb.id DESC
            LIMIT 1
          ), 0)
      ),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;

  UPDATE wallet_transactions
  SET remaining_amount = 0,
      updated_at = CURRENT_TIMESTAMP
  WHERE user_id = NEW.user_id
    AND order_id = NEW.order_id
    AND type = 'cashback'
    AND status = 'completed'
    AND remaining_amount IS NOT NULL;
END;