PRAGMA foreign_keys = ON;

-- Phase 1 keeps the existing shared wallet backend and does not create new tables.
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_enabled', '1');
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_min_order_amount', '0');
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_max_per_order', '0');
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_eligibility_mode', 'all');
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_selected_user_ids', '');
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_expiry_months', '6');

-- Each new cashback credit is tracked inside the existing wallet_transactions table.
ALTER TABLE wallet_transactions ADD COLUMN remaining_amount INTEGER;
ALTER TABLE wallet_transactions ADD COLUMN expires_at TEXT;
ALTER TABLE wallet_transactions ADD COLUMN expired_at TEXT;

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_cashback_expiry
ON wallet_transactions(user_id, type, status, expires_at);

-- A completed cashback transaction becomes its own spendable/expiring bucket.
CREATE TRIGGER IF NOT EXISTS trg_cashback_tx_defaults
AFTER INSERT ON wallet_transactions
WHEN NEW.type = 'cashback' AND NEW.status = 'completed'
BEGIN
  UPDATE wallet_transactions
  SET
    remaining_amount = ABS(COALESCE(NEW.amount, 0)),
    expires_at = CASE
      WHEN CAST(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_expiry_months'), '0') AS INTEGER) > 0
      THEN datetime(
        NEW.created_at,
        '+' || CAST((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_expiry_months') AS INTEGER) || ' months'
      )
      ELSE NULL
    END,
    expired_at = NULL
  WHERE id = NEW.id;
END;

-- Checkout consumes active cashback first, earliest expiry first.
CREATE TRIGGER IF NOT EXISTS trg_checkout_debit_consume_cashback
AFTER INSERT ON wallet_transactions
WHEN NEW.type = 'debit' AND NEW.source = 'checkout' AND NEW.status = 'completed'
BEGIN
  UPDATE wallet_transactions
  SET remaining_amount = MAX(
    0,
    remaining_amount - MAX(
      0,
      ABS(NEW.amount) - COALESCE((
        SELECT SUM(prev.remaining_amount)
        FROM wallet_transactions AS prev
        WHERE prev.user_id = NEW.user_id
          AND prev.type = 'cashback'
          AND prev.status = 'completed'
          AND COALESCE(prev.remaining_amount, 0) > 0
          AND (prev.expires_at IS NULL OR prev.expires_at > CURRENT_TIMESTAMP)
          AND (
            COALESCE(prev.expires_at, '9999-12-31 23:59:59') < COALESCE(wallet_transactions.expires_at, '9999-12-31 23:59:59')
            OR (
              COALESCE(prev.expires_at, '9999-12-31 23:59:59') = COALESCE(wallet_transactions.expires_at, '9999-12-31 23:59:59')
              AND prev.id < wallet_transactions.id
            )
          )
      ), 0)
    )
  )
  WHERE user_id = NEW.user_id
    AND type = 'cashback'
    AND status = 'completed'
    AND COALESCE(remaining_amount, 0) > 0
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);
END;

-- Server-side cashback rules for every newly-created order, independent of frontend values.
CREATE TRIGGER IF NOT EXISTS trg_orders_cashback_rules_insert
AFTER INSERT ON orders
BEGIN
  UPDATE orders
  SET
    cashback_amount = CASE
      WHEN LOWER(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_enabled'), '1')) NOT IN ('1', 'true', 'on', 'yes') THEN 0
      WHEN COALESCE(NEW.total_amount, 0) < CAST(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_min_order_amount'), '0') AS INTEGER) THEN 0
      WHEN LOWER(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_eligibility_mode'), 'all')) = 'vip'
        AND LOWER(COALESCE((SELECT role FROM users WHERE id = NEW.user_id), '')) <> 'vip' THEN 0
      WHEN LOWER(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_eligibility_mode'), 'all')) = 'selected'
        AND instr(
          ',' || replace(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_selected_user_ids'), ''), ' ', '') || ',',
          ',' || CAST(NEW.user_id AS TEXT) || ','
        ) = 0 THEN 0
      ELSE CASE
        WHEN CAST(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_max_per_order'), '0') AS INTEGER) > 0
        THEN MIN(
          CAST(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_max_per_order'), '0') AS INTEGER),
          CAST(ROUND(
            MAX(0, COALESCE(NEW.total_amount, 0) - COALESCE(NEW.wallet_used_amount, 0))
            * CAST(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_percent'), '0') AS REAL)
            / 100.0
          ) AS INTEGER)
        )
        ELSE CAST(ROUND(
          MAX(0, COALESCE(NEW.total_amount, 0) - COALESCE(NEW.wallet_used_amount, 0))
          * CAST(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_percent'), '0') AS REAL)
          / 100.0
        ) AS INTEGER)
      END
    END,
    cashback_status = CASE
      WHEN LOWER(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_enabled'), '1')) IN ('1', 'true', 'on', 'yes')
        AND CAST(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_percent'), '0') AS REAL) > 0
        AND COALESCE(NEW.total_amount, 0) >= CAST(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_min_order_amount'), '0') AS INTEGER)
        AND MAX(0, COALESCE(NEW.total_amount, 0) - COALESCE(NEW.wallet_used_amount, 0)) > 0
        AND NOT (
          LOWER(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_eligibility_mode'), 'all')) = 'vip'
          AND LOWER(COALESCE((SELECT role FROM users WHERE id = NEW.user_id), '')) <> 'vip'
        )
        AND NOT (
          LOWER(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_eligibility_mode'), 'all')) = 'selected'
          AND instr(
            ',' || replace(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_selected_user_ids'), ''), ' ', '') || ',',
            ',' || CAST(NEW.user_id AS TEXT) || ','
          ) = 0
        )
      THEN 'pending'
      ELSE 'none'
    END
  WHERE id = NEW.id;
END;
